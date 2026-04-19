import 'dotenv/config';
// src/routes/upload.ts
import express, { Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { deleteStoredDocument, saveUploadedDocument } from '../services/documentStorage';
import { enqueueDocumentProcessing } from '../services/documentProcessingQueue';
import { logger } from '../lib/logger';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  }
});

function uploadSingleDocument(req: AuthRequest, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('document')(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'File size must be less than 10MB';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Upload failed';
}

// Upload document
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  let storedFile: { storedFilename: string; fileUrl: string } | null = null;
  let documentId: string | null = null;

  try {
    await uploadSingleDocument(req, res);

    if (!req.file?.buffer) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    storedFile = await saveUploadedDocument({
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      userId: req.user!.id,
    });

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename: storedFile.storedFilename,
        originalName: req.file.originalname,
        fileUrl: storedFile.fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        status: 'PENDING'
      }
    });
    documentId = document.id;

    await enqueueDocumentProcessing(document.id);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        filename: document.originalName,
        status: document.status
      }
    });
  } catch (error) {
    logger.error('Upload error:', error);

    if (error instanceof multer.MulterError) {
      res.status(400).json({ message: getUploadErrorMessage(error) });
      return;
    }

    if (error instanceof Error && error.message.startsWith('Invalid file type')) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (documentId) {
      try {
        await prisma.document.delete({ where: { id: documentId } });
      } catch (cleanupError) {
        logger.warn('Upload DB cleanup error:', cleanupError);
      }
    }

    if (storedFile) {
      try {
        await deleteStoredDocument({
          filename: storedFile.storedFilename,
          fileUrl: storedFile.fileUrl,
        });
      } catch (cleanupError) {
        logger.warn('Upload cleanup error:', cleanupError);
      }
    }

    res.status(503).json({ message: 'Upload failed. Processing could not be scheduled.' });
  }
});

export default router;
