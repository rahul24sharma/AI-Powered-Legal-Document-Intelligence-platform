import { ClauseType } from '@prisma/client';
import { analyzeDocumentWithContext } from './aiAnalyzer';

import {
  createEmbedding,
  storeDocumentEmbedding,
  findSimilarDocuments,
  detectDocumentType,
  storeClauseEmbeddings,
  updateDocumentWithAnalysis,
} from './pineconeService';
import { rankSimilarDocuments } from './similarityRanking';
import { prisma } from '../lib/prisma';
import { extractTextFromStoredDocument } from './documentTextExtractor';
import { logger } from '../lib/logger';

const CONTEXT_SIMILAR_RETRIEVAL_K = 18;

const VALID_CLAUSE_TYPES: ClauseType[] = [
  'TERMINATION',
  'PAYMENT',
  'LIABILITY',
  'CONFIDENTIALITY',
  'INTELLECTUAL_PROPERTY',
  'DISPUTE_RESOLUTION',
  'FORCE_MAJEURE',
  'OTHER'
];

export async function processDocument(documentId: string): Promise<void> {
  try {
    logger.info(`Processing document ${documentId}...`);

    const lock = await prisma.document.updateMany({
      where: {
        id: documentId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: { status: 'PROCESSING' }
    });

    if (lock.count === 0) {
      const existing = await prisma.document.findUnique({
        where: { id: documentId },
        select: { status: true },
      });
      logger.info(`Skipping document ${documentId}; current status is ${existing?.status ?? 'missing'}`);
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true, analysis: { select: { id: true } } }
    });

    if (!document) throw new Error('Document not found');
    if (document.analysis) {
      logger.info(`Document ${documentId} already has analysis; marking completed`);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' }
      });
      return;
    }

    const extractedText = await extractTextFromStoredDocument(document);

    if (!extractedText.trim()) throw new Error('No text could be extracted from document');

    logger.debug(`Extracted ${extractedText.length} characters from document`);

    const documentType = detectDocumentType(extractedText);
    const documentEmbedding = await createEmbedding(extractedText);

    const storeDocumentPromise = storeDocumentEmbedding(
      documentId,
      extractedText,
      {
        userId: document.userId,
        documentType,
        fileName: document.originalName,
        organizationId: document.organizationId || undefined,
      },
      { embedding: documentEmbedding }
    );

    const pineconeMatchesPromise = findSimilarDocuments(
      extractedText,
      document.userId,
      CONTEXT_SIMILAR_RETRIEVAL_K,
      { embedding: documentEmbedding }
    );

    await storeDocumentPromise;
    const pineconeMatches = await pineconeMatchesPromise;

    const filtered = pineconeMatches.filter((m) => m.id !== documentId);
    const dbForRank = await prisma.document.findMany({
      where: {
        id: { in: filtered.map((m) => m.id) },
        userId: document.userId,
      },
      select: {
        id: true,
        originalName: true,
        createdAt: true,
        analysis: {
          select: { overallSummary: true, riskScore: true },
        },
      },
    });

    const rankedContext = rankSimilarDocuments(filtered, extractedText, dbForRank, {
      limit: 1,
    });

    const similarDocuments = rankedContext.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    logger.debug(`Found ${similarDocuments.length} ranked similar documents for context`);

    const analysis = await analyzeDocumentWithContext(extractedText, similarDocuments);

    const savedAnalysis = await prisma.analysis.create({
      data: {
        documentId: document.id,
        riskScore: analysis.riskScore,
        overallSummary: analysis.overallSummary,
        plainEnglish: analysis.plainEnglish,
        keyTerms: analysis.keyTerms,
        riskFactors: analysis.riskFactors,
        recommendations: analysis.recommendations,
        clauses: {
          create: analysis.clauses.map((clause: any) => ({
            type: VALID_CLAUSE_TYPES.includes(clause.type)
              ? clause.type
              : 'OTHER', // ✅ fallback for unexpected types
            content: clause.content,
            riskLevel: clause.riskLevel,
            explanation: clause.explanation,
            suggestions: clause.suggestions,
            position: {
              page: clause.position?.page ?? 0,
              section: clause.position?.section ?? 'N/A'
            }
          }))
        }
      },
      include: { clauses: true }
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' }
    });

    void (async () => {
      try {
        if (savedAnalysis.clauses.length > 0) {
          await storeClauseEmbeddings(documentId, savedAnalysis.clauses, document.userId);
        }

        await updateDocumentWithAnalysis(documentId, analysis);
      } catch (backgroundError) {
        logger.warn(`Background Pinecone sync failed for ${documentId}:`, backgroundError);
      }
    })();

    logger.info(`Document ${documentId} processed successfully with Pinecone integration`);

  } catch (error) {
    logger.error(`Error processing document ${documentId}:`, error);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' }
    });
  }
}
