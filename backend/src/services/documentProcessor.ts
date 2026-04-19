import { ClauseType } from '@prisma/client';
import { analyzeDocumentWithContext } from './aiAnalyzer';
import {
  createEmbedding,
  storeDocumentEmbedding,
  detectDocumentType,
  storeClauseEmbeddings,
  updateDocumentWithAnalysis,
} from './pineconeService';
import { prisma } from '../lib/prisma';
import { extractTextFromStoredDocument } from './documentTextExtractor';
import { logger } from '../lib/logger';

const VALID_CLAUSE_TYPES: ClauseType[] = [
  'TERMINATION',
  'PAYMENT',
  'LIABILITY',
  'CONFIDENTIALITY',
  'INTELLECTUAL_PROPERTY',
  'DISPUTE_RESOLUTION',
  'FORCE_MAJEURE',
  'OTHER',
];

const activeProcessingControllers = new Map<string, AbortController>();

function createProcessingController(documentId: string): AbortController {
  const controller = new AbortController();
  activeProcessingControllers.set(documentId, controller);
  return controller;
}

function clearProcessingController(documentId: string): void {
  activeProcessingControllers.delete(documentId);
}

export function cancelDocumentProcessing(documentId: string): boolean {
  const controller = activeProcessingControllers.get(documentId);
  if (!controller) return false;
  controller.abort(new DOMException('Document processing cancelled', 'AbortError'));
  return true;
}

async function isDocumentCancelled(documentId: string, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return true;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { status: true },
  });

  return document?.status === 'CANCELLED';
}

export async function processDocument(documentId: string): Promise<void> {
  const startedAt = Date.now();
  const controller = createProcessingController(documentId);

  try {
    logger.info(`Processing document ${documentId}...`);

    const lock = await prisma.document.updateMany({
      where: {
        id: documentId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: { status: 'PROCESSING' },
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
      include: { user: true, analysis: { select: { id: true } } },
    });

    if (!document) throw new Error('Document not found');
    if (document.analysis) {
      logger.info(`Document ${documentId} already has analysis; marking completed`);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });
      return;
    }

    if (document.status === 'CANCELLED') {
      logger.info(`Document ${documentId} was cancelled before processing started`);
      return;
    }

    const extractedText = await extractTextFromStoredDocument(document);
    if (!extractedText.trim()) throw new Error('No text could be extracted from document');

    logger.debug(`Extracted ${extractedText.length} characters from document in ${Date.now() - startedAt}ms`);

    const documentType = detectDocumentType(extractedText);
    const embeddingStartedAt = Date.now();
    const documentEmbedding = await createEmbedding(extractedText);
    logger.debug(`Created document embedding in ${Date.now() - embeddingStartedAt}ms`);

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

    if (await isDocumentCancelled(documentId, controller.signal)) {
      logger.info(`Document ${documentId} cancelled before analysis`);
      return;
    }

    const analysisStartedAt = Date.now();
    const analysis = await analyzeDocumentWithContext(extractedText, [], {
      signal: controller.signal,
    });
    logger.debug(`Completed AI analysis in ${Date.now() - analysisStartedAt}ms`);

    if (await isDocumentCancelled(documentId, controller.signal)) {
      logger.info(`Document ${documentId} cancelled after analysis`);
      return;
    }

    const persistStartedAt = Date.now();
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
            type: VALID_CLAUSE_TYPES.includes(clause.type) ? clause.type : 'OTHER',
            content: clause.content,
            riskLevel: clause.riskLevel,
            explanation: clause.explanation,
            suggestions: clause.suggestions,
            position: {
              page: clause.position?.page ?? 0,
              section: clause.position?.section ?? 'N/A',
            },
          })),
        },
      },
      include: { clauses: true },
    });

    if (await isDocumentCancelled(documentId, controller.signal)) {
      logger.info(`Document ${documentId} cancelled before finalizing`);
      return;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' },
    });
    logger.debug(`Persisted analysis and marked completed in ${Date.now() - persistStartedAt}ms`);

    void (async () => {
      try {
        await storeDocumentPromise;

        if (savedAnalysis.clauses.length > 0) {
          await storeClauseEmbeddings(documentId, savedAnalysis.clauses, document.userId);
        }

        await updateDocumentWithAnalysis(documentId, analysis);
      } catch (backgroundError) {
        logger.warn(`Background Pinecone sync failed for ${documentId}:`, backgroundError);
      }
    })();

    logger.info(`Document ${documentId} processed successfully with Pinecone integration in ${Date.now() - startedAt}ms`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || /cancelled/i.test(error.message))
    ) {
      logger.info(`Document ${documentId} processing cancelled after ${Date.now() - startedAt}ms`);
      return;
    }

    logger.error(`Error processing document ${documentId} after ${Date.now() - startedAt}ms:`, error);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' },
    });
  } finally {
    clearProcessingController(documentId);
  }
}
