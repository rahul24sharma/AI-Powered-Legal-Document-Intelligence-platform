// src/routes/upload.ts
import express, { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { processDocument } from '../services/documentProcessor';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
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

// Upload document
router.post('/', authenticateToken, upload.single('document'), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        status: 'PENDING'
      }
    });

    // Start processing in background (we'll implement this next)
    processDocument(document.id).catch(console.error);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        filename: document.originalName,
        status: document.status
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

export default router;