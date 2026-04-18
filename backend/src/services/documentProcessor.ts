import { ClauseType } from '@prisma/client';
import { analyzeDocumentWithContext } from './aiAnalyzer';

import {
  storeDocumentEmbedding,
  findSimilarDocuments,
  detectDocumentType,
  storeClauseEmbeddings,
  updateDocumentWithAnalysis,
} from './pineconeService';
import { rankSimilarDocuments } from './similarityRanking';
import { prisma } from '../lib/prisma';
import { extractTextFromStoredDocument } from './documentTextExtractor';

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
    console.log(`📄 Processing document ${documentId}...`);

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
      console.log(`⏭️ Skipping document ${documentId}; current status is ${existing?.status ?? 'missing'}`);
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true, analysis: { select: { id: true } } }
    });

    if (!document) throw new Error('Document not found');
    if (document.analysis) {
      console.log(`⏭️ Document ${documentId} already has analysis; marking completed`);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' }
      });
      return;
    }

    const extractedText = await extractTextFromStoredDocument(document);

    if (!extractedText.trim()) throw new Error('No text could be extracted from document');

    console.log(`📝 Extracted ${extractedText.length} characters from document`);

    const documentType = detectDocumentType(extractedText);
    await storeDocumentEmbedding(documentId, extractedText, {
      userId: document.userId,
      documentType,
      fileName: document.originalName,
      organizationId: document.organizationId || undefined
    });

    const pineconeMatches = await findSimilarDocuments(
      extractedText,
      document.userId,
      CONTEXT_SIMILAR_RETRIEVAL_K
    );

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
      limit: 3,
    });

    const similarDocuments = rankedContext.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    console.log(`🔍 Found ${similarDocuments.length} ranked similar documents for context`);

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

    if (savedAnalysis.clauses.length > 0) {
      await storeClauseEmbeddings(documentId, savedAnalysis.clauses, document.userId);
    }

    await updateDocumentWithAnalysis(documentId, analysis);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' }
    });

    console.log(`✅ Document ${documentId} processed successfully with Pinecone integration`);

  } catch (error) {
    console.error(`❌ Error processing document ${documentId}:`, error);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' }
    });
  }
}
