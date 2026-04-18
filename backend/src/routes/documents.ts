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

const router = express.Router();

const SIMILAR_RETRIEVAL_TOP_K = 28;
const SIMILAR_RESPONSE_LIMIT = 10;

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
  } catch (error) {
    console.error('Fetch documents error:', error);
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
    console.error('Fetch document error:', error);
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
    console.error('Fetch document status error:', error);
    res.status(500).json({ message: 'Failed to fetch document status' });
  }
});

/** Re-rank related documents using embeddings, lexical overlap, and recency. */
router.get('/:id/similar', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    const extractedText = await extractTextFromStoredDocument(document);

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
    console.error('Error finding similar documents:', error);
    res.status(500).json({ message: 'Failed to find similar documents' });
  }
});

export default router;
