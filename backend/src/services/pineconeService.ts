import 'dotenv/config';
// backend/src/services/pineconeService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { logger } from '../lib/logger';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openAiKey = process.env.OPENAI_API_KEY;
const hasLikelyOpenAiKey =
  !!openAiKey && !openAiKey.startsWith('sk-ant-') && !openAiKey.startsWith('claude-');

const openai = hasLikelyOpenAiKey
  ? new OpenAI({
      apiKey: openAiKey!,
    })
  : null;

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'legal-documents';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1024);
const EMBEDDING_PROVIDER = (
  process.env.EMBEDDING_PROVIDER ||
  (process.env.OLLAMA_BASE_URL ? 'ollama' : hasLikelyOpenAiKey ? 'openai' : 'local')
).toLowerCase();
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// Initialize Pinecone index
export async function initializePinecone() {
  try {
    const index = pinecone.index(INDEX_NAME);
    logger.debug('Pinecone initialized successfully');
    return index;
  } catch (error) {
    logger.error('Failed to initialize Pinecone:', error);
    throw error;
  }
}

// Create embedding for text
export async function createEmbedding(text: string): Promise<number[]> {
  const input = text.substring(0, 8000);
  try {
    if (EMBEDDING_PROVIDER === 'openai') {
      if (!openai) throw new Error('OPENAI_API_KEY missing');
      logger.debug('Creating embedding with OpenAI...');
      const response = await openai.embeddings.create({
        model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
        input,
        dimensions: EMBEDDING_DIM,
      });
      return normalizeEmbedding(response.data[0].embedding, EMBEDDING_DIM);
    }

    if (EMBEDDING_PROVIDER === 'ollama') {
      logger.debug(`Creating embedding with Ollama (${OLLAMA_EMBED_MODEL})...`);
      const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_EMBED_MODEL,
          prompt: input,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Ollama embeddings error ${res.status}: ${t}`);
      }
      const data = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error('No embedding returned by Ollama');
      }
      return normalizeEmbedding(data.embedding, EMBEDDING_DIM);
    }

    logger.debug('Creating deterministic local embedding...');
    return deterministicLocalEmbedding(input, EMBEDDING_DIM);
  } catch (error) {
    logger.error('Failed to create embedding:', error);
    if (EMBEDDING_PROVIDER !== 'local') {
      logger.debug('Falling back to deterministic local embedding...');
      return deterministicLocalEmbedding(input, EMBEDDING_DIM);
    }
    throw error;
  }
}

function normalizeEmbedding(values: number[], dim: number): number[] {
  if (values.length === dim) return values;
  if (values.length > dim) return values.slice(0, dim);
  const out = new Array(dim).fill(0);
  for (let i = 0; i < values.length; i++) out[i] = values[i];
  return out;
}

function deterministicLocalEmbedding(text: string, dim: number): number[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const vec = new Array(dim).fill(0);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

// Store document in Pinecone
export async function storeDocumentEmbedding(
  documentId: string,
  documentText: string,
  metadata: {
    userId: string;
    documentType: string;
    fileName: string;
    riskScore?: number;
    keyIssues?: string[];
    organizationId?: string;
  },
  options?: { embedding?: number[] }
) {
  try {
    logger.debug('Storing document embedding in Pinecone...');
    
    const index = await initializePinecone();
    const embedding = options?.embedding ?? await createEmbedding(documentText);
    
    await index.upsert([{
      id: documentId,
      values: embedding,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        textPreview: documentText.substring(0, 200) + '...'
      }
    }]);
    
    logger.debug(`Document ${documentId} stored in Pinecone`);
  } catch (error) {
    logger.error('Failed to store document embedding:', error);
    // Don't throw - embedding storage is optional
  }
}

// Find similar documents
export async function findSimilarDocuments(
  documentText: string,
  userId: string,
  topK: number = 5,
  options?: { embedding?: number[] }
) {
  try {
    logger.debug('Finding similar documents...');

    const index = await initializePinecone();
    const embedding = options?.embedding ?? await createEmbedding(documentText);

    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: {
        userId: userId
      }
    });

    logger.debug(`Found ${results.matches?.length || 0} similar documents`);

    return (results.matches || []).map(match => ({
      id: match.id,
      similarity: match.score || 0,
      metadata: match.metadata
    }));
  } catch (error: any) {
    logger.warn('Failed to find similar documents:', error?.message || error);
    return [];
  }
}


// Find similar clauses
export async function findSimilarClauses(
  clauseText: string,
  clauseType: string,
  userId: string,
  topK: number = 5
) {
  try {
    logger.debug('Finding similar clauses...');
    
    const index = await initializePinecone();
    const embedding = await createEmbedding(clauseText);
    
    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: {
        userId: userId,
        type: 'clause',
        clauseType: clauseType
      }
    });
    
    return results.matches.map(match => ({
      id: match.id,
      similarity: match.score || 0,
      content: match.metadata?.content,
      riskLevel: match.metadata?.riskLevel,
      suggestions: match.metadata?.suggestions
    }));
  } catch (error) {
    logger.warn('Failed to find similar clauses:', error);
    return [];
  }
}

// Store individual clauses for better similarity matching
export async function storeClauseEmbeddings(
  documentId: string,
  clauses: any[],
  userId: string
) {
  try {
    logger.debug('Storing clause embeddings...');
    
    const index = await initializePinecone();
    const vectors = [];
    
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const embedding = await createEmbedding(clause.content);
      
      vectors.push({
        id: `${documentId}-clause-${i}`,
        values: embedding,
        metadata: {
          type: 'clause',
          documentId,
          userId,
          clauseType: clause.type,
          content: clause.content,
          riskLevel: clause.riskLevel,
          suggestions: clause.suggestions,
          explanation: clause.explanation
        }
      });
    }
    
    if (vectors.length > 0) {
      await index.upsert(vectors);
      logger.debug(`Stored ${vectors.length} clause embeddings`);
    }
  } catch (error) {
    logger.error('Failed to store clause embeddings:', error);
  }
}

// Detect document type from content
export function detectDocumentType(text: string): string {
  const content = text.toLowerCase();
  
  if (content.includes('non-disclosure') || content.includes('confidentiality')) {
    return 'NDA';
  } else if (content.includes('employment') || content.includes('job') || content.includes('salary')) {
    return 'Employment Contract';
  } else if (content.includes('service') && content.includes('agreement')) {
    return 'Service Agreement';
  } else if (content.includes('lease') || content.includes('rental')) {
    return 'Lease Agreement';
  } else if (content.includes('purchase') || content.includes('sale')) {
    return 'Purchase Agreement';
  } else if (content.includes('license')) {
    return 'License Agreement';
  } else {
    return 'Legal Document';
  }
}

// Update document with analysis results
export async function updateDocumentWithAnalysis(
  documentId: string,
  analysis: any
) {
  try {
    logger.debug('Updating document with analysis results...');

    const index = await initializePinecone();

    await index.update({
      id: documentId,
      metadata: {
        riskScore: analysis.riskScore,
        keyIssues: analysis.riskFactors?.map((rf: any) => rf.factor) || [],
        analyzed: true,
        analysisDate: new Date().toISOString()
      }
    });

    logger.debug(`Updated document ${documentId} with analysis`);
  } catch (error: any) {
    logger.warn('Failed to update document:', error?.message || error);
  }
}
