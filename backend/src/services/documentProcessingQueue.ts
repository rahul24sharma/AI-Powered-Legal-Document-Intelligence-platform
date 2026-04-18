import 'dotenv/config';
import Queue from 'bull';
import { processDocument } from './documentProcessor';

type ProcessingJob = {
  documentId: string;
};

let processingQueue: Queue.Queue<ProcessingJob> | null = null;
let queueInitialized = false;
let inlineFallbackWarned = false;

function shouldUseInlineFallback(): boolean {
  return process.env.NODE_ENV !== 'production';
}

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
    console.error('Document processing queue error:', error);
  });

  processingQueue.on('failed', (job, error) => {
    console.error(`Document processing job ${job?.id ?? 'unknown'} failed:`, error);
  });

  return processingQueue;
}

/** Initialize the document processing worker so uploads are handled via a durable queue. */
export async function initializeDocumentProcessingQueue(): Promise<void> {
  if (queueInitialized) return;
  queueInitialized = true;

  const queue = getQueue();
  if (!queue) {
    if (shouldUseInlineFallback() && !inlineFallbackWarned) {
      inlineFallbackWarned = true;
      console.warn('REDIS_URL not configured. Falling back to in-process document processing.');
    }
    return;
  }

  await queue.isReady();
  await queue.process(async (job) => {
    await processDocument(job.data.documentId);
  });
  console.log('Document processing queue ready');
}

/** Enqueue one document for background processing, with a dev-only inline fallback. */
export async function enqueueDocumentProcessing(documentId: string): Promise<void> {
  const queue = getQueue();

  if (!queue) {
    if (!shouldUseInlineFallback()) {
      throw new Error('Document processing queue is unavailable');
    }

    setImmediate(() => {
      void processDocument(documentId).catch((error) => {
        console.error(`Inline document processing failed for ${documentId}:`, error);
      });
    });
    return;
  }

  await queue.isReady();
  await queue.add(
    { documentId },
    {
      jobId: documentId,
    }
  );
}
