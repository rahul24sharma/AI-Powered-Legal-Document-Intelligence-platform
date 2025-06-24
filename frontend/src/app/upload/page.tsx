"use client";

// import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-gray-600">Upload your legal documents for AI-powered analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <DocumentUploader />
        </div>

        {/* Upload Guidelines */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supported Formats</CardTitle>
              <CardDescription>
                File types we can analyze
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm">PDF documents (.pdf)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm">Word documents (.docx, .doc)</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Guidelines</CardTitle>
              <CardDescription>
                Best practices for document analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong>File Size:</strong> Maximum 10MB per document
              </div>
              <div>
                <strong>Quality:</strong> Clear, readable text for best results
              </div>
              <div>
                <strong>Language:</strong> Currently supports English documents
              </div>
              <div>
                <strong>Privacy:</strong> Your documents are processed securely and never shared
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What We Analyze</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>• Risk assessment and scoring</div>
              <div>• Key terms and clauses identification</div>
              <div>• Plain English summaries</div>
              <div>• Improvement recommendations</div>
              <div>• Compliance and legal risks</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}