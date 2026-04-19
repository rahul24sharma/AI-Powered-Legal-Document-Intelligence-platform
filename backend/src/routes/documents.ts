import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { findSimilarDocuments } from '../services/pineconeService';
import {
  rankSimilarDocuments,
  type RankInputDoc,
} from '../services/similarityRanking';
import { prisma } from '../lib/prisma';
import { extractTextFromStoredDocument } from '../services/documentTextExtractor';
import { tryCreateDocumentAccessUrl } from '../services/documentStorage';
import { logger } from '../lib/logger';
import { cancelDocumentProcessing } from '../services/documentProcessor';

const router = express.Router();

const SIMILAR_RETRIEVAL_TOP_K = 28;
const SIMILAR_RESPONSE_LIMIT = 10;
const DEFAULT_PAGE_SIZE = 10;

type DocumentsSummary = {
  totalDocuments: number;
  analyzedCount: number;
  elevatedRiskCount: number;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSearchQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function documentMatchesSearch(
  document: {
    originalName: string;
    mimeType: string;
    status: string;
    analysis?: {
      overallSummary?: string | null;
      plainEnglish?: string | null;
      keyTerms?: unknown;
      riskFactors?: unknown;
      recommendations?: unknown;
      clauses?: unknown;
    } | null;
  },
  query: string
): boolean {
  if (!query) return true;

  const haystackParts = [
    document.originalName,
    document.mimeType,
    document.status,
    document.analysis?.overallSummary ?? '',
    document.analysis?.plainEnglish ?? '',
    Array.isArray(document.analysis?.keyTerms) ? document.analysis!.keyTerms.map(String).join(' ') : '',
    Array.isArray(document.analysis?.riskFactors)
      ? document.analysis!.riskFactors.map((rf: any) => [rf?.factor, rf?.explanation].filter(Boolean).join(' ')).join(' ')
      : '',
    Array.isArray(document.analysis?.recommendations)
      ? document.analysis!.recommendations.map((rec: any) => [rec?.category, rec?.suggestion].filter(Boolean).join(' ')).join(' ')
      : '',
    Array.isArray(document.analysis?.clauses)
      ? document.analysis!.clauses.map((clause: any) => [clause?.type, clause?.content, clause?.explanation].filter(Boolean).join(' ')).join(' ')
      : '',
  ];

  return haystackParts.join(' ').toLowerCase().includes(query);
}

async function buildDocumentsSummary(userId: string): Promise<DocumentsSummary> {
  const documents = await prisma.document.findMany({
    where: { userId },
    select: {
      analysis: {
        select: {
          riskScore: true,
        },
      },
    },
  });

  let analyzedCount = 0;
  let elevatedRiskCount = 0;

  for (const doc of documents) {
    if (doc.analysis) {
      analyzedCount += 1;
      if (doc.analysis.riskScore >= 70) {
        elevatedRiskCount += 1;
      }
    }
  }

  return {
    totalDocuments: documents.length,
    analyzedCount,
    elevatedRiskCount,
  };
}

async function enrichDocumentWithDownloadUrl<T extends { id: string; filename: string; fileUrl: string; status?: string }>(
  document: T
): Promise<T & { downloadUrl: string | null }> {
  const shouldSign = document.status === undefined || document.status === 'COMPLETED';
  const downloadUrl = shouldSign ? await tryCreateDocumentAccessUrl(document) : null;
  return { ...document, downloadUrl };
}

/** Return the current user's document library with lightweight analysis metadata. */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE);
    const searchQuery = parseSearchQuery(req.query.q);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined || searchQuery.length > 0;

    if (!shouldPaginate) {
      const documents = await prisma.document.findMany({
        where: { userId: req.user!.id },
        include: {
          analysis: {
            select: {
              id: true,
              riskScore: true,
              overallSummary: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ documents });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { userId: req.user!.id },
      include: {
        analysis: {
          select: {
            id: true,
            riskScore: true,
            overallSummary: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const filteredDocuments = searchQuery
      ? documents.filter((document) => documentMatchesSearch(document, searchQuery))
      : documents;
    const skip = (page - 1) * limit;
    const pagedDocuments = filteredDocuments.slice(skip, skip + limit);
    const summary = await buildDocumentsSummary(req.user!.id);
    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / limit));

    res.json({
      documents: pagedDocuments,
      pagination: {
        page,
        limit,
        total: filteredDocuments.length,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: searchQuery ? {
        totalDocuments: filteredDocuments.length,
        analyzedCount: filteredDocuments.filter((document) => Boolean(document.analysis)).length,
        elevatedRiskCount: filteredDocuments.filter((document) => document.analysis && document.analysis.riskScore >= 70).length,
      } : summary,
    });
  } catch (error) {
    logger.error('Fetch documents error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

/** Return one document with its full stored analysis payload. */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        analysis: {
          include: {
            clauses: true
          }
        }
      }
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    const enrichedDocument = await enrichDocumentWithDownloadUrl(document);
    res.json({ document: enrichedDocument });
  } catch (error) {
    logger.error('Fetch document error:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

/** Return lightweight processing state so the UI can poll without refetching full document payloads. */
router.get('/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        analysis: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json({
      status: {
        id: document.id,
        state: document.status,
        analysisReady: Boolean(document.analysis),
        updatedAt: document.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Fetch document status error:', error);
    res.status(500).json({ message: 'Failed to fetch document status' });
  }
});

/** Cancel an in-progress document review. */
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        analysis: {
          include: {
            clauses: true,
          },
        },
      },
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    if (!['PENDING', 'PROCESSING'].includes(document.status)) {
      res.status(409).json({ message: 'Document is no longer cancellable' });
      return;
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'CANCELLED' },
    });

    cancelDocumentProcessing(document.id);

    const cancelledDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: {
        analysis: {
          include: {
            clauses: true,
          },
        },
      },
    });

    if (!cancelledDocument) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    const enrichedDocument = await enrichDocumentWithDownloadUrl(cancelledDocument);
    res.json({ message: 'Document processing cancelled', document: enrichedDocument });
  } catch (error) {
    logger.error('Cancel document error:', error);
    res.status(500).json({ message: 'Failed to cancel document processing' });
  }
});

/** Re-rank related documents using embeddings, lexical overlap, and recency. */
router.get('/:id/similar', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        analysis: {
          include: {
            clauses: true,
          },
        },
      },
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    let extractedText = '';
    try {
      extractedText = await extractTextFromStoredDocument(document);
    } catch (error) {
      const fallbackText = buildSimilarSearchFallbackText(document);
      if (!fallbackText) {
        throw error;
      }

      logger.warn(`Similar-doc source missing for ${document.id}; using analysis fallback.`);
      extractedText = fallbackText;
    }

    if (!extractedText.trim()) {
      res.json({
        similarDocuments: [],
        count: 0,
        ranking: {
          retrievalTopK: SIMILAR_RETRIEVAL_TOP_K,
          responseLimit: SIMILAR_RESPONSE_LIMIT,
          method: 'fallback-empty-result',
        },
      });
      return;
    }

    const pineconeMatches = await findSimilarDocuments(
      extractedText,
      req.user!.id,
      SIMILAR_RETRIEVAL_TOP_K
    );

    const filteredMatches = pineconeMatches.filter((m) => m.id !== req.params.id);
    const similarDocIds = filteredMatches.map((doc) => doc.id);

    const dbRows = await prisma.document.findMany({
      where: {
        id: { in: similarDocIds },
        userId: req.user!.id,
      },
      include: {
        analysis: {
          select: {
            riskScore: true,
            overallSummary: true,
          },
        },
      },
    });

    const rankInputs: RankInputDoc[] = dbRows.map((d) => ({
      id: d.id,
      originalName: d.originalName,
      createdAt: d.createdAt,
      analysis: d.analysis,
    }));

    const ranked = rankSimilarDocuments(filteredMatches, extractedText, rankInputs, {
      limit: SIMILAR_RESPONSE_LIMIT,
    });

    const prismaById = new Map(dbRows.map((d) => [d.id, d]));

    const enrichedSimilarDocs = ranked
      .map((r) => {
        const doc = prismaById.get(r.id);
        if (!doc) return null;

        const relevancePercent = Math.round(r.similarity * 100);
        return {
          ...doc,
          similarity: relevancePercent,
          relevanceScore: relevancePercent,
          scoreBreakdown: {
            vector: Math.round(r.vectorScore * 100),
            keyword: Math.round(r.keywordScore * 100),
            recency: Math.round(r.recencyScore * 100),
            hybridRank: Math.round(r.hybridRrfScore * 100),
          },
          rankingMethod: 'hybrid_rrf_recency',
        };
      })
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

    res.json({
      similarDocuments: enrichedSimilarDocs,
      count: enrichedSimilarDocs.length,
      ranking: {
        retrievalTopK: SIMILAR_RETRIEVAL_TOP_K,
        responseLimit: SIMILAR_RESPONSE_LIMIT,
        method: 'pinecone_vectors + lexical_overlap + reciprocal_rank_fusion + recency',
      },
    });
  } catch (error) {
    logger.error('Error finding similar documents:', error);
    res.json({
      similarDocuments: [],
      count: 0,
      ranking: {
        retrievalTopK: SIMILAR_RETRIEVAL_TOP_K,
        responseLimit: SIMILAR_RESPONSE_LIMIT,
        method: 'fallback-empty-result',
      },
    });
  }
});

/** Build a lightweight similarity search surrogate when the uploaded file is missing. */
function buildSimilarSearchFallbackText(document: {
  originalName: string;
  mimeType: string;
  analysis?: {
    overallSummary: string | null;
    plainEnglish: string | null;
    keyTerms: unknown;
    riskFactors?: unknown;
    recommendations?: unknown;
    clauses?: unknown;
  } | null;
}): string | null {
  if (!document.analysis) return null;

  const keyTerms = Array.isArray(document.analysis.keyTerms)
    ? document.analysis.keyTerms.map(String).join(' ')
    : '';
  const riskFactors = Array.isArray(document.analysis.riskFactors)
    ? document.analysis.riskFactors
        .map((rf: any) => [rf?.factor, rf?.explanation].filter(Boolean).join(' '))
        .join(' ')
    : '';
  const recommendations = Array.isArray(document.analysis.recommendations)
    ? document.analysis.recommendations
        .map((rec: any) => [rec?.category, rec?.suggestion].filter(Boolean).join(' '))
        .join(' ')
    : '';
  const clauses = Array.isArray(document.analysis.clauses)
    ? document.analysis.clauses
        .map((clause: any) => [clause?.type, clause?.content, clause?.explanation].filter(Boolean).join(' '))
        .join(' ')
    : '';

  return [
    document.originalName,
    document.mimeType,
    document.analysis.overallSummary ?? '',
    document.analysis.plainEnglish ?? '',
    keyTerms,
    riskFactors,
    recommendations,
    clauses,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default router;
