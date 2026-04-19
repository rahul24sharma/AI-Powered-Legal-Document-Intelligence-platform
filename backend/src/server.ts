import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import uploadRoutes from './routes/upload';
import { ensureUploadDir } from './utils/uploadPaths';
import { primeRedisConnection } from './lib/redis';
import {
  createTokenBucketLimiter,
  rateLimitKeyGenerators,
} from './middleware/tokenBucketRateLimit';
import { initializeDocumentProcessingQueue } from './services/documentProcessingQueue';
import { logger } from './lib/logger';

const app = express();
const PORT = process.env.PORT || 5050;
const uploadDir = ensureUploadDir();

app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url} - Origin: ${req.get('Origin')}`);
  next();
});

// Security middleware
app.use(helmet());
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const extra =
    process.env.CORS_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const baseAllow = new Set(
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
      ...extra,
    ].filter((x): x is string => Boolean(x))
  );

  if (baseAllow.has(origin)) return true;

  // Allow Next.js dev server on LAN (e.g. http://10.0.0.164:3000) — browser Origin must match.
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    const devPorts = new Set(['3000', '3001', '3002']);
    if (!devPorts.has(port)) return false;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (process.env.NODE_ENV === 'development') {
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true;
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true;
      if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(u.hostname))
        return true;
    }
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      logger.warn('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
  })
);

/** Keep auth attempts tight, but allow normal in-app polling and document browsing. */
const authLimiter = createTokenBucketLimiter({
  name: 'auth',
  capacity: 10,
  refillTokens: 25,
  refillWindowMs: 15 * 60 * 1000,
  keyGenerator: rateLimitKeyGenerators.authAttempt,
  message: 'Too many authentication attempts, please try again later.',
});

/** Uploads are heavier operations, so keep them protected without affecting reads. */
const uploadLimiter = createTokenBucketLimiter({
  name: 'upload',
  capacity: 8,
  refillTokens: 40,
  refillWindowMs: 15 * 60 * 1000,
  message: 'Too many upload requests, please try again later.',
});

/** General API reads need a much higher ceiling because the UI polls live document status. */
const generalApiLimiter = createTokenBucketLimiter({
  name: 'documents',
  capacity: 120,
  refillTokens: 1200,
  refillWindowMs: 15 * 60 * 1000,
  message: 'Too many requests, please try again later.',
});

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (for uploaded documents)
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/documents', generalApiLimiter, documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({ 
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

void primeRedisConnection();
void initializeDocumentProcessingQueue();

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
});
