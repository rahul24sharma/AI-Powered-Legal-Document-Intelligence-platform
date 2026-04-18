"use client";

import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="border-0 pb-0 text-3xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-2 text-muted-foreground">
          Add PDF or Word documents for AI-powered review
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentUploader />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supported formats</CardTitle>
              <CardDescription>Files we can process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                PDF (.pdf)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Word (.docx, .doc)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Size:</span> Up to 10 MB per file
              </p>
              <p>
                <span className="font-medium text-foreground">Quality:</span> Clear, selectable text works best
              </p>
              <p>
                <span className="font-medium text-foreground">Language:</span> English
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
