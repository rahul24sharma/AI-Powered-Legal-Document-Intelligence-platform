"use client";

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Calendar,
  Download,
  AlertTriangle,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { documentsAPI } from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import { getPublicFileUrl } from '@/lib/asset-url';
import type { Document } from '@/types';
import { cn, formatDate, formatFileSize } from '@/lib/utils';
import {
  getDocumentStatusBadgeClass,
  getDocumentStatusIcon,
  getRiskProgressClass,
  getRiskScoreClass,
} from '@/lib/document-ui';

const SimilarDocsLazy = dynamic(
  () =>
    import('@/components/documents/SimilarDocumentsSection').then((m) => ({
      default: m.SimilarDocumentsSection,
    })),
  {
    loading: () => (
      <div className="rounded-xl border border-border/80 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Loading related documents…
      </div>
    ),
    ssr: false,
  }
);

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const documentId = params.id as string;
  const documentStatus = document?.status;
  const hasAnalysis = Boolean(document?.analysis);
  const isProcessing = documentStatus === 'PROCESSING';
  const isCompleted = documentStatus === 'COMPLETED' && hasAnalysis;
  const isCancelled = documentStatus === 'CANCELLED';
  const analysisClauses = document?.analysis?.clauses ?? [];
  const topRiskClauses = [...analysisClauses].sort((a, b) => {
    const riskWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    return riskWeight[b.riskLevel] - riskWeight[a.riskLevel];
  }).slice(0, 5);

  /** Narrow unknown polling payloads into the lightweight status shape this page expects. */
  const isDocumentStatusPayload = (
    payload: unknown
  ): payload is { status: { id: string; state: Document['status']; analysisReady: boolean; updatedAt: string } } => {
    if (!payload || typeof payload !== 'object') return false;
    const maybe = payload as { status?: { id?: unknown; state?: unknown; analysisReady?: unknown } };
    return (
      !!maybe.status &&
      typeof maybe.status.id === 'string' &&
      typeof maybe.status.state === 'string' &&
      typeof maybe.status.analysisReady === 'boolean'
    );
  };

  /** Fetch the latest document state, optionally without showing the full page loader. */
  const fetchDocument = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError('');

        const response = await documentsAPI.getDocument(documentId);
        setDocument(response.document);
      } catch (err: unknown) {
        setError(getAxiosErrorMessage(err, 'Failed to fetch document'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [documentId]
  );

  useEffect(() => {
    if (documentId) void fetchDocument();
  }, [documentId, fetchDocument]);

  useEffect(() => {
    if (!documentId || !documentStatus) return;
    if (documentStatus === 'COMPLETED' || documentStatus === 'FAILED' || documentStatus === 'CANCELLED') return;

    const unsubscribe = documentsAPI.subscribeToDocumentStatus(documentId, {
      onMessage: (payload) => {
        if (isDocumentStatusPayload(payload)) {
          const nextStatus = payload.status.state;

          setDocument((prev) => (prev ? { ...prev, status: nextStatus } : prev));
          setRefreshing(nextStatus === 'PROCESSING');

          if (
            nextStatus === 'COMPLETED' ||
            nextStatus === 'FAILED' ||
            (payload.status.analysisReady && !hasAnalysis)
          ) {
            void fetchDocument(true);
          }
        }
      },
      onError: () => {
        setRefreshing(false);
      },
    });

    return unsubscribe;
  }, [documentId, documentStatus, fetchDocument, hasAnalysis]);

  const handleCancelProcessing = useCallback(async () => {
    if (!document || cancelling) return;

    try {
      setCancelling(true);
      setError('');
      const response = await documentsAPI.cancelDocumentProcessing(document.id);
      setDocument(response.document);
      setRefreshing(false);
    } catch (err: unknown) {
      setError(getAxiosErrorMessage(err, 'Failed to cancel document processing'));
    } finally {
      setCancelling(false);
    }
  }, [cancelling, document]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-muted" />
          <div className="h-4 w-1/3 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">Document not found</h3>
            <p className="mt-2 max-w-md text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => fetchDocument()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = getDocumentStatusIcon(document.status);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0 space-y-1">
            <h1 className="border-0 pb-0 text-2xl font-semibold tracking-tight sm:text-3xl">
              {document.originalName}
            </h1>
            <p className="text-muted-foreground">Document details and analysis</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refreshing && <RefreshCw className="h-4 w-4 animate-spin text-primary" aria-hidden />}
          {document.status === 'COMPLETED' && document.analysis ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/documents/${document.id}/report`} target="_blank" rel="noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                Export report
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void fetchDocument()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {isProcessing && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-5 w-5 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-primary">Analysis in progress</p>
                <p className="text-sm text-muted-foreground">
                  ClaudeIQ is extracting clauses, scoring risk, and preparing the executive summary.
                  This page will update automatically when the analysis is ready.
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="w-fit border border-primary/20 bg-white/80 font-normal text-primary">
              Live processing
            </Badge>
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Need to stop this review?</p>
                <p className="text-sm text-muted-foreground">
                  You can cancel the analysis while it is running. The document will stop processing and keep its current state.
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void handleCancelProcessing()} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel analysis'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isCompleted && (
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="font-medium text-emerald-700 dark:text-emerald-300">Analysis ready</p>
                <p className="text-sm text-muted-foreground">
                  Your document has been reviewed. Jump to the analysis, export the report, or download the source file.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/documents/${document.id}/report`} target="_blank" rel="noreferrer">
                  <Printer className="mr-2 h-4 w-4" />
                  Export report
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  window.document
                    .getElementById('document-analysis')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                Jump to analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                <StatusIcon
                  className={cn(
                    'h-5 w-5',
                    document.status === 'COMPLETED' && 'text-emerald-600 dark:text-emerald-400',
                    document.status === 'PROCESSING' && 'animate-spin text-primary',
                    document.status === 'FAILED' && 'text-destructive',
                    document.status === 'CANCELLED' && 'text-muted-foreground',
                    !['COMPLETED', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(document.status) && 'text-primary'
                  )}
                />
                <span>Properties</span>
                {document.status === 'PROCESSING' && (
                  <span className="text-sm font-normal text-muted-foreground">· Live updates</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary" className={cn('mt-1 font-normal', getDocumentStatusBadgeClass(document.status))}>
                    {document.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File size</p>
                  <p className="mt-1 text-sm font-medium">{formatFileSize(document.fileSize)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="mt-1 text-sm font-medium">{document.mimeType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(document.createdAt, { includeTime: true, longMonth: true })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {document.analysis && (
            <Card id="document-analysis">
              <CardHeader>
                <CardTitle>Risk analysis</CardTitle>
                <CardDescription>Risk assessment, clause extraction, and summaries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Risk score</span>
                    <span
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        getRiskScoreClass(document.analysis.riskScore)
                      )}
                    >
                      {document.analysis.riskScore}/100
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        getRiskProgressClass(document.analysis.riskScore)
                      )}
                      style={{ width: `${document.analysis.riskScore}%` }}
                    />
                  </div>
                </div>

                {topRiskClauses.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Top risky clauses</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        These are the clause areas most likely to need negotiation or legal review.
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {topRiskClauses.map((clause, index) => (
                        <div
                          key={clause.id || `${clause.type}-${index}`}
                          className="rounded-xl border border-border/70 bg-muted/30 p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'font-normal',
                                    clause.riskLevel === 'CRITICAL' &&
                                      'border-destructive/30 bg-destructive/10 text-destructive',
                                    clause.riskLevel === 'HIGH' &&
                                      'border-amber-300/60 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
                                    clause.riskLevel === 'MEDIUM' &&
                                      'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
                                    clause.riskLevel === 'LOW' &&
                                      'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  )}
                                >
                                  {clause.type.replace(/_/g, ' ')}
                                </Badge>
                                <Badge variant="outline" className="font-normal">
                                  {clause.riskLevel} risk
                                </Badge>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground">{clause.content}</p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Clause #{index + 1}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why it matters</p>
                              <p className="mt-1 text-sm leading-relaxed">{clause.explanation}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested checks</p>
                              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                                {clause.suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                                  <li key={`${suggestion}-${suggestionIndex}`}>• {suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Summary</p>
                  <p className="text-sm leading-relaxed">{document.analysis.overallSummary}</p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Plain language</p>
                  <p className="text-sm leading-relaxed">{document.analysis.plainEnglish}</p>
                </div>

                {document.analysis.keyTerms && document.analysis.keyTerms.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Key terms</p>
                    <div className="flex flex-wrap gap-2">
                      {document.analysis.keyTerms.map((term, index) => (
                        <Badge key={index} variant="outline" className="font-normal">
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

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {document.status === 'PROCESSING' && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing…
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live status updates are streamed while analysis runs.
                </p>
              </CardContent>
            </Card>
          )}

          {document.status === 'FAILED' && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Processing failed
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try uploading the file again from the upload page.
                </p>
              </CardContent>
            </Card>
          )}

          {isCancelled && (
            <Card className="border-muted-foreground/20 bg-muted/40">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  Processing cancelled
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  The review was stopped before completion. You can upload it again if you want to restart analysis.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {document.downloadUrl ? (
                <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                  <a
                    href={getPublicFileUrl(document.downloadUrl)}
                    download={document.originalName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="w-full justify-start" size="sm" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
              {['PENDING', 'PROCESSING'].includes(document.status) && (
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => void handleCancelProcessing()}
                  disabled={cancelling}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {cancelling ? 'Cancelling…' : 'Cancel analysis'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {document.status === 'COMPLETED' && <SimilarDocsLazy documentId={document.id} />}
    </div>
  );
}
