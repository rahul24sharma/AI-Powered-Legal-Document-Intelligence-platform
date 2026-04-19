"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { documentsAPI } from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import { formatFileSize } from '@/lib/utils';

/** Reject unsupported files before they ever hit the API. */
function validateUploadFile(file: File): string | null {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedTypes.includes(file.type)) {
    return 'Only PDF and Word documents are supported';
  }

  if (file.size > 10 * 1024 * 1024) {
    return 'File size must be less than 10MB';
  }

  return null;
}

interface UploadedFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  id?: string;
  error?: string;
}

export function DocumentUploader() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const router = useRouter();

  /** Upload one file and keep the local queue state in sync with its progress. */
  const uploadFile = useCallback(async (file: File, options?: { autoOpen?: boolean }) => {
    const uploadedFile: UploadedFile = {
      file,
      progress: 0,
      status: 'uploading',
    };

    setUploadedFiles((prev) => [...prev, uploadedFile]);
    const progressInterval = setInterval(() => {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === file && f.status === 'uploading'
            ? { ...f, progress: Math.min(f.progress + 10, 90) }
            : f
        )
      );
    }, 200);

    try {
      const response = await documentsAPI.uploadDocument(file);

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, progress: 100, status: 'completed', id: response.document.id }
            : f
        )
      );

      if (options?.autoOpen) {
        router.push(`/documents/${response.document.id}`);
      }
    } catch (error: unknown) {
      const msg = getAxiosErrorMessage(error, 'Upload failed');
      setUploadedFiles((prev) =>
        prev.map((f) => (f.file === file ? { ...f, status: 'error', error: msg } : f))
      );
    } finally {
      clearInterval(progressInterval);
    }
  }, [router]);

  /** Validate all selected files and enqueue accepted ones for upload. */
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const autoOpen = files.length === 1;

      Array.from(files).forEach((file) => {
        const err = validateUploadFile(file);
        if (err) {
          setUploadedFiles((prev) => [
            ...prev,
            {
              file,
              progress: 0,
              status: 'error',
              error: err,
            },
          ]);
        } else {
          void uploadFile(file, { autoOpen });
        }
      });
    },
    [uploadFile]
  );

  /** Handle drag-and-drop uploads from the browser surface. */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  /** Highlight the dropzone while the user drags files over it. */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  /** Remove dropzone highlight when the pointer leaves the drag surface. */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  /** Remove a file row from the local upload queue. */
  const removeFile = (file: File) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file !== file));
  };

  /** Jump straight to the uploaded document once the API returns its id. */
  const viewDocument = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Drop files here</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              or choose files from your computer
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <Button asChild className="mt-6">
              <label htmlFor="file-upload" className="cursor-pointer">
                Browse files
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">Upload queue</h3>
            <div className="space-y-4">
              {uploadedFiles.map((uploadedFile, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-xl border border-border p-4"
                >
                  <File className="h-8 w-8 shrink-0 text-primary" />

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{uploadedFile.file.name}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {uploadedFile.status === 'completed' && (
                          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {uploadedFile.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(uploadedFile.file)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Remove"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <p className="mb-2 text-sm text-muted-foreground">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>

                    {uploadedFile.status === 'uploading' && (
                      <Progress value={uploadedFile.progress} className="h-2" />
                    )}

                    {uploadedFile.status === 'error' && (
                      <p className="text-sm text-destructive">{uploadedFile.error}</p>
                    )}

                    {uploadedFile.status === 'completed' && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">Upload complete</p>
                        {uploadedFile.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(uploadedFile.id!)}
                          >
                            View document
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
