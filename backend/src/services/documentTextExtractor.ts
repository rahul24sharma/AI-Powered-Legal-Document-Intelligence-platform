import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import type { Document } from '@prisma/client';
import { downloadStoredDocument } from './documentStorage';
import { getRedisClient } from '../lib/redis';
import { logger } from '../lib/logger';

const memoryTextCache = new Map<string, string>();

function buildCacheKey(document: Pick<Document, 'id' | 'updatedAt'>): string | null {
  if (!document.id || !document.updatedAt) return null;
  return `document-text:${document.id}:${new Date(document.updatedAt).toISOString()}`;
}

async function getCachedDocumentText(cacheKey: string): Promise<string | null> {
  const redisClient = await getRedisClient();

  if (redisClient) {
    try {
      const value = await redisClient.get(cacheKey);
      return value ?? null;
    } catch (error) {
      logger.warn('Document text cache read failed:', error);
    }
  }

  return memoryTextCache.get(cacheKey) ?? null;
}

async function setCachedDocumentText(cacheKey: string, text: string): Promise<void> {
  const redisClient = await getRedisClient();

  if (redisClient) {
    try {
      await redisClient.set(cacheKey, text, { PX: 1000 * 60 * 60 });
      return;
    } catch (error) {
      logger.warn('Document text cache write failed:', error);
    }
  }

  memoryTextCache.set(cacheKey, text);
}

/** Read a stored upload and return its plain-text content for analysis or search. */
export async function extractTextFromStoredDocument(
  document: Pick<Document, 'id' | 'updatedAt' | 'filename' | 'fileUrl' | 'mimeType'>
): Promise<string> {
  const cacheKey = buildCacheKey(document);
  if (cacheKey) {
    const cached = await getCachedDocumentText(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const fileBuffer = await downloadStoredDocument(document);
  let text = '';

  if (document.mimeType === 'application/pdf') {
    const pdfData = await pdf(fileBuffer);
    text = pdfData.text;
  } else if (document.mimeType.includes('word')) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    text = result.value;
  }

  if (cacheKey) {
    await setCachedDocumentText(cacheKey, text);
  }

  return text;
}
