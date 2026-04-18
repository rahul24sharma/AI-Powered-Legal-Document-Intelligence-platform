import 'dotenv/config';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Document } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBackendOrigin } from '../utils/serverOrigin';
import { getUploadedFilePath, persistLocalUpload } from '../utils/uploadPaths';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

let supabaseClient: SupabaseClient | null = null;

function isSupabaseStorageEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/** Lazily initialize the backend-only Supabase client. */
function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Storage is not configured');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseClient;
}

function resolveSupabaseSignedUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (!SUPABASE_URL) {
    throw new Error('Supabase URL missing while resolving signed URL');
  }

  return `${SUPABASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

/** Build a stable object key for a user-scoped uploaded document. */
function buildStoragePath(userId: string, originalName: string): string {
  const ext = path.extname(originalName) || '.bin';
  return `${userId}/${Date.now()}-${randomUUID()}${ext}`;
}

function isSupabaseDocument(document: Pick<Document, 'fileUrl'>): boolean {
  return document.fileUrl.startsWith('supabase://');
}

function parseSupabaseFileUrl(fileUrl: string): { bucket: string; objectPath: string } {
  const cleaned = fileUrl.replace(/^supabase:\/\//, '');
  const firstSlash = cleaned.indexOf('/');
  if (firstSlash === -1) {
    throw new Error('Invalid Supabase fileUrl');
  }

  return {
    bucket: cleaned.slice(0, firstSlash),
    objectPath: cleaned.slice(firstSlash + 1),
  };
}

/** Remove a stored document object after a partial failure or explicit cleanup. */
export async function deleteStoredDocument(document: Pick<Document, 'filename' | 'fileUrl'>): Promise<void> {
  if (isSupabaseDocument(document)) {
    const { bucket, objectPath } = parseSupabaseFileUrl(document.fileUrl);
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
    return;
  }

  const fs = await import('fs');
  const fullPath = getUploadedFilePath(document.filename);
  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
  }
}

/** Store a freshly uploaded document in Supabase when configured, otherwise local disk. */
export async function saveUploadedDocument(params: {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  userId: string;
}): Promise<{ storedFilename: string; fileUrl: string }> {
  const { fileBuffer, originalName, mimeType, userId } = params;

  if (isSupabaseStorageEnabled()) {
    const objectPath = buildStoragePath(userId, originalName);
    const supabase = getSupabaseClient();

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
      storedFilename: objectPath,
      fileUrl: `supabase://${SUPABASE_STORAGE_BUCKET}/${objectPath}`,
    };
  }

  const ext = path.extname(originalName);
  const localFilename = `document-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  persistLocalUpload(localFilename, fileBuffer);
  return {
    storedFilename: localFilename,
    fileUrl: `/uploads/${localFilename}`,
  };
}

/** Download raw bytes for a stored document regardless of whether it lives locally or in Supabase. */
export async function downloadStoredDocument(document: Pick<Document, 'filename' | 'fileUrl'>): Promise<Buffer> {
  if (isSupabaseDocument(document)) {
    const { bucket, objectPath } = parseSupabaseFileUrl(document.fileUrl);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);

    if (error || !data) {
      throw new Error(`Supabase download failed: ${error?.message || 'No file returned'}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  return await import('fs').then((fs) => fs.promises.readFile(getUploadedFilePath(document.filename)));
}

/** Create a browser-usable download URL for either legacy local files or private Supabase objects. */
export async function createDocumentAccessUrl(
  document: Pick<Document, 'id' | 'filename' | 'fileUrl'>,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (isSupabaseDocument(document)) {
    const { bucket, objectPath } = parseSupabaseFileUrl(document.fileUrl);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed URL failed: ${error?.message || 'No signed URL returned'}`);
    }

    return resolveSupabaseSignedUrl(data.signedUrl);
  }

  return `${getBackendOrigin()}/uploads/${document.filename}`;
}

/** Best-effort access URL generation that never breaks document reads if signing fails. */
export async function tryCreateDocumentAccessUrl(
  document: Pick<Document, 'id' | 'filename' | 'fileUrl'>,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  try {
    return await createDocumentAccessUrl(document, expiresInSeconds);
  } catch (error) {
    console.error(`Failed to create access URL for document ${document.id}:`, error);
    return null;
  }
}
