import 'dotenv/config';
import Queue from 'bull';
import { processDocument } from './documentProcessor';
import { logger } from '../lib/logger';

type ProcessingJob = {
  documentId: string;
};

let processingQueue: Queue.Queue<ProcessingJob> | null = null;
let queueInitialized = false;
let inlineFallbackWarned = false;

function getQueue(): Queue.Queue<ProcessingJob> | null {
  if (processingQueue) return processingQueue;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  processingQueue = new Queue<ProcessingJob>('document-processing', redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  });

  processingQueue.on('error', (error) => {
    logger.error('Document processing queue error:', error);
  });

  processingQueue.on('failed', (job, error) => {
    logger.error(`Document processing job ${job?.id ?? 'unknown'} failed:`, error);
  });

  return processingQueue;
}

function runInlineProcessing(documentId: string): void {
  setImmediate(() => {
    void processDocument(documentId).catch((error) => {
      logger.error(`Inline document processing failed for ${documentId}:`, error);
    });
  });
}

/** Initialize the document processing worker so uploads are handled via a durable queue. */
export async function initializeDocumentProcessingQueue(): Promise<void> {
  if (queueInitialized) return;
  queueInitialized = true;

  const queue = getQueue();
  if (!queue) {
    if (!inlineFallbackWarned) {
      inlineFallbackWarned = true;
      logger.warn('REDIS_URL not configured. Falling back to direct document processing.');
    }
    return;
  }

  try {
    await queue.isReady();
    await queue.process(async (job) => {
      await processDocument(job.data.documentId);
    });
    logger.info('Document processing queue ready');
  } catch (error) {
    logger.error('Document queue initialization failed, falling back to direct processing:', error);
  }
}

/** Enqueue one document for background processing, with a direct-processing fallback. */
export async function enqueueDocumentProcessing(documentId: string): Promise<void> {
  const queue = getQueue();

  if (!queue) {
    runInlineProcessing(documentId);
    return;
  }

  try {
    await queue.isReady();
    await queue.add(
      { documentId },
      {
        jobId: documentId,
      }
    );
  } catch (error) {
    logger.error('Queue enqueue failed, falling back to direct processing:', error);
    runInlineProcessing(documentId);
  }
}
