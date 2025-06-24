// src/routes/documents.ts
import express, { Response, NextFunction } from 'express'; // ADD NextFunction
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { findSimilarDocuments } from '../services/pineconeService';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { analyzeDocumentWithContext } from '../services/aiAnalyzer';
import { storeDocumentEmbedding, detectDocumentType } from '../services/pineconeService';
import { storeClauseEmbeddings, updateDocumentWithAnalysis } from '../services/pineconeService';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's documents - ADD NextFunction parameter
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

// Get specific document with analysis - ADD NextFunction parameter
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    res.json({ document });
  } catch (error) {
    console.error('Fetch document error:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.get('/:id/similar', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    // Get document text (you might need to re-extract this)
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

    // Find similar documents
    const similarDocs = await findSimilarDocuments(extractedText, req.user!.id, 5);

    // Get full document details for similar documents
    const similarDocIds = similarDocs.map(doc => doc.id).filter(id => id !== req.params.id);
    
    const fullSimilarDocs = await prisma.document.findMany({
      where: {
        id: { in: similarDocIds },
        userId: req.user!.id
      },
      include: {
        analysis: {
          select: {
            riskScore: true,
            overallSummary: true
          }
        }
      }
    });

    // Combine similarity scores with document details
    const enrichedSimilarDocs = fullSimilarDocs.map(doc => {
      const similarity = similarDocs.find(sim => sim.id === doc.id)?.similarity || 0;
      return {
        ...doc,
        similarity: Math.round(similarity * 100) // Convert to percentage
      };
    });

    res.json({ 
      similarDocuments: enrichedSimilarDocs,
      count: enrichedSimilarDocs.length 
    });
  } catch (error) {
    console.error('Error finding similar documents:', error);
    res.status(500).json({ message: 'Failed to find similar documents' });
  }
});

export default router;