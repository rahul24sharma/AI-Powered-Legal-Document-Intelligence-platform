// src/app/documents/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Calendar, Download, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { documentsAPI } from '@/lib/api';
import type { Document } from '@/types';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const documentId = params.id as string;

  useEffect(() => {
    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  // Auto-refresh for processing documents
  useEffect(() => {
    if (document?.status === 'PROCESSING') {
      const interval = setInterval(() => {
        fetchDocument(true); // Silent refresh
      }, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }
  }, [document?.status]);

  const fetchDocument = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      const response = await documentsAPI.getDocument(documentId);
      setDocument(response.document);
      
      if (!silent) {
        console.log('📄 Document loaded:', response.document);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'PROCESSING':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-red-900 mb-2">Document Not Found</h3>
              <p className="text-red-700 mb-4">
                {error || 'The document you are looking for does not exist or has been removed.'}
              </p>
              <Button onClick={() => fetchDocument()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{document.originalName}</h1>
            <p className="text-gray-600">Document Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {refreshing && (
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          )}
          <Button variant="outline" onClick={() => fetchDocument()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {document.status === 'COMPLETED' && document.analysis && (
            <Button asChild>
              <Link href={`/documents/${document.id}/analysis`}>
                View Full Analysis
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Document Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getStatusIcon(document.status)}
                <span>Document Information</span>
                {document.status === 'PROCESSING' && (
                  <span className="text-sm text-blue-600">(Auto-refreshing...)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(document.status)}>
                      {document.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">File Size</label>
                  <p className="mt-1 text-sm text-gray-900">{formatFileSize(document.fileSize)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">File Type</label>
                  <p className="mt-1 text-sm text-gray-900">{document.mimeType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Uploaded</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(document.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Summary */}
          {document.analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  AI-powered risk assessment and key insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Risk Score</span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg font-bold ${
                      document.analysis.riskScore > 70 ? 'text-red-600' :
                      document.analysis.riskScore > 40 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {document.analysis.riskScore}/100
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      document.analysis.riskScore > 70 ? 'bg-red-500' :
                      document.analysis.riskScore > 40 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${document.analysis.riskScore}%` }}
                  ></div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 block mb-2">Summary</label>
                  <p className="text-sm text-gray-700">
                    {document.analysis.overallSummary}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 block mb-2">Plain English</label>
                  <p className="text-sm text-gray-700">
                    {document.analysis.plainEnglish}
                  </p>
                </div>

                {/* Key Terms */}
                {document.analysis.keyTerms && document.analysis.keyTerms.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 block mb-2">Key Terms</label>
                    <div className="flex flex-wrap gap-2">
                      {document.analysis.keyTerms.map((term, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {document.status === 'PROCESSING' && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="py-4">
                <div className="flex items-center space-x-2 text-blue-700">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Processing document...</span>
                </div>
                <p className="text-sm text-blue-600 mt-2">
                  Your document is being analyzed. This page will update automatically when complete.
                </p>
              </CardContent>
            </Card>
          )}

          {document.status === 'FAILED' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-4">
                <div className="flex items-center space-x-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Processing failed</span>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  There was an error processing your document. Please try uploading again.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Document
              </Button>
              {document.status === 'COMPLETED' && document.analysis && (
                <Button asChild className="w-full justify-start" size="sm">
                  <Link href={`/documents/${document.id}/analysis`}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Full Analysis
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}