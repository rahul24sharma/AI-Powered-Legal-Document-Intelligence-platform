import { detectDocumentType } from './pineconeService';

export interface PineconeSimilarMatch {
  id: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface RankInputDoc {
  id: string;
  originalName: string;
  createdAt: Date;
  analysis?: {
    overallSummary: string | null;
    riskScore: number;
  } | null;
}

export interface RankedSimilarDocument {
  id: string;
  similarity: number;
  vectorScore: number;
  keywordScore: number;
  recencyScore: number;
  hybridRrfScore: number;
  metadata?: Record<string, unknown>;
}

const RRF_K = 60;

/** Normalize Pinecone cosine / dot scores into [0, 1]. */
function normalizeVectorScore(raw: number): number {
  if (Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(1, raw));
}

function tokenize(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return new Set(normalized);
}

/** Lexical overlap: fraction of query tokens present in document corpus (BM25-style surrogate). */
export function keywordOverlapScore(queryText: string, documentCorpus: string): number {
  const q = tokenize(queryText.slice(0, 16000));
  const d = tokenize(documentCorpus.slice(0, 32000));
  if (q.size === 0) return 0;
  let overlap = 0;
  for (const t of q) {
    if (d.has(t)) overlap++;
  }
  return overlap / q.size;
}

function recencyScore(createdAt: Date, now: Date): number {
  const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return Math.exp(-ageDays / 180);
}

function buildCorpus(match: PineconeSimilarMatch, row?: RankInputDoc): string {
  const meta = match.metadata ?? {};
  const preview = typeof meta.textPreview === 'string' ? meta.textPreview : '';
  const fileName =
    typeof meta.fileName === 'string'
      ? meta.fileName
      : row?.originalName ?? '';
  const summary = row?.analysis?.overallSummary ?? '';
  return [row?.originalName ?? '', fileName, summary, preview].join('\n');
}

/**
 * Hybrid ranking: reciprocal rank fusion (vector vs lexical lists) blended with recency,
 * plus a small boost when Pinecone metadata document type aligns with detected query type.
 */
export function rankSimilarDocuments(
  matches: PineconeSimilarMatch[],
  queryText: string,
  dbDocs: RankInputDoc[],
  options?: { limit?: number; now?: Date }
): RankedSimilarDocument[] {
  const limit = options?.limit ?? 10;
  const now = options?.now ?? new Date();
  const dbMap = new Map(dbDocs.map((d) => [d.id, d]));

  const queryDocType = detectDocumentType(queryText);

  const enriched = matches.map((m) => {
    const row = dbMap.get(m.id);
    const corpus = buildCorpus(m, row);
    const kw = keywordOverlapScore(queryText, corpus);
    const vec = normalizeVectorScore(m.similarity);
    const created = row?.createdAt ?? new Date(0);
    const rec = recencyScore(created, now);

    const metaType =
      typeof m.metadata?.documentType === 'string'
        ? String(m.metadata.documentType)
        : '';
    let typeBoost = 1;
    if (metaType && metaType === queryDocType) {
      typeBoost = 1.06;
    }

    return { match: m, kw, vec, rec, typeBoost };
  });

  const byVec = [...enriched].sort((a, b) => b.vec - a.vec);
  const byKw = [...enriched].sort((a, b) => b.kw - a.kw);

  const rrf = new Map<string, number>();
  byVec.forEach((e, i) => {
    const id = e.match.id;
    rrf.set(id, (rrf.get(id) ?? 0) + 1 / (RRF_K + i + 1));
  });
  byKw.forEach((e, i) => {
    const id = e.match.id;
    rrf.set(id, (rrf.get(id) ?? 0) + 1 / (RRF_K + i + 1));
  });

  const maxRrf = Math.max(...rrf.values(), 1e-9);

  const ranked: RankedSimilarDocument[] = enriched.map((e) => {
    const id = e.match.id;
    const rrfNorm = (rrf.get(id) ?? 0) / maxRrf;
    let blended = 0.74 * rrfNorm + 0.26 * e.rec;
    blended *= e.typeBoost;
    blended = Math.max(0, Math.min(1, blended));

    return {
      id,
      similarity: blended,
      vectorScore: e.vec,
      keywordScore: e.kw,
      recencyScore: e.rec,
      hybridRrfScore: rrfNorm,
      metadata: e.match.metadata,
    };
  });

  ranked.sort((a, b) => b.similarity - a.similarity);
  return ranked.slice(0, limit);
}
