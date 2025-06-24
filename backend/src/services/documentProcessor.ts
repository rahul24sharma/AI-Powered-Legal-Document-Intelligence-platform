import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { PrismaClient, ClauseType } from '@prisma/client';
import { 
  analyzeDocumentWithContext,
  analyzeDocument
} from './aiAnalyzer';

import { 
  storeDocumentEmbedding, 
  findSimilarDocuments, 
  detectDocumentType,
  storeClauseEmbeddings,
  updateDocumentWithAnalysis
} from './pineconeService';

const prisma = new PrismaClient();

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

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' }
    });

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true }
    });

    if (!document) throw new Error('Document not found');

    const filePath = path.join(process.env.UPLOAD_DIR || './uploads', document.filename);
    let extractedText = '';

    if (document.mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      extractedText = pdfData.text;
    } else if (document.mimeType.includes('word')) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    }

    if (!extractedText.trim()) throw new Error('No text could be extracted from document');

    console.log(`📝 Extracted ${extractedText.length} characters from document`);

    const documentType = detectDocumentType(extractedText);
    await storeDocumentEmbedding(documentId, extractedText, {
      userId: document.userId,
      documentType,
      fileName: document.originalName,
      organizationId: document.organizationId || undefined
    });

    const similarDocuments = await findSimilarDocuments(
      extractedText, 
      document.userId, 
      3
    );

    console.log(`🔍 Found ${similarDocuments.length} similar documents for context`);

    const analysis = await analyzeDocumentWithContext(extractedText, similarDocuments);

    const savedAnalysis = await prisma.analysis.create({
      data: {
        documentId: document.id,
        riskScore: analysis.riskScore,
        overallSummary: analysis.overallSummary,
        plainEnglish: analysis.plainEnglish,
        keyTerms: analysis.keyTerms,
        riskFactors: {
          create: analysis.riskFactors
        },
        recommendations: {
          create: analysis.recommendations
        },
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
