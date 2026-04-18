import fs from 'fs';
import path from 'path';

function resolveBaseUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.isAbsolute(process.env.UPLOAD_DIR)
      ? process.env.UPLOAD_DIR
      : path.resolve(process.cwd(), process.env.UPLOAD_DIR);
  }

  return path.resolve(process.cwd(), 'uploads');
}

export function getUploadDir(): string {
  return resolveBaseUploadDir();
}

export function ensureUploadDir(): string {
  const dir = resolveBaseUploadDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getUploadedFilePath(filename: string): string {
  return path.join(resolveBaseUploadDir(), filename);
}

/** Persist a file buffer into the legacy local uploads directory. */
export function persistLocalUpload(filename: string, fileBuffer: Buffer): string {
  const outputPath = getUploadedFilePath(filename);
  ensureUploadDir();
  fs.writeFileSync(outputPath, fileBuffer);
  return outputPath;
}
