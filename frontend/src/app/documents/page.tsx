"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Calendar, AlertTriangle } from 'lucide-react';
import { documentsAPI } from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import type { Document } from '@/types';
import { cn, formatDate, formatFileSize } from '@/lib/utils';
import {
  getDocumentStatusBadgeClass,
  getRiskProgressClass,
  getRiskScoreClass,
} from '@/lib/document-ui';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const analyzedCount = documents.filter((document) => Boolean(document.analysis)).length;
  const elevatedRiskCount = documents.filter(
    (document) => document.analysis && document.analysis.riskScore > 70
  ).length;

  useEffect(() => {
    fetchDocuments();
  }, []);

  /** Load the current document list shown on the library page. */
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await documentsAPI.getDocuments();
      setDocuments(response.documents);
    } catch (err: unknown) {
      setError(getAxiosErrorMessage(err, 'Failed to fetch documents'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-5 w-72 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="mb-2 h-5 w-3/4 rounded-md bg-muted" />
                <div className="h-4 w-1/2 rounded-md bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <h1 className="border-0 pb-0 text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="max-w-2xl text-muted-foreground">
            Browse your uploaded files, compare risk at a glance, and jump straight into analysis.
          </p>
          {!loading && documents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1 font-normal">
                {documents.length} total
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 font-normal">
                {analyzedCount} analyzed
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  'rounded-full px-3 py-1 font-normal',
                  elevatedRiskCount > 0 && 'bg-destructive/10 text-destructive'
                )}
              >
                {elevatedRiskCount} elevated risk
              </Badge>
            </div>
          ) : null}
        </div>
        <Button asChild className="shadow-sm">
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {documents.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Upload a PDF or Word file to generate analysis and risk scores.
            </p>
            <Button asChild className="mt-6">
              <Link href="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload document
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {documents.map((document) => (
              <Card
                key={document.id}
                className="overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm"
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/documents/${document.id}`}
                            className="line-clamp-2 font-medium leading-snug text-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {document.originalName}
                          </Link>
                          {document.analysis && document.analysis.riskScore > 70 ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(document.createdAt, { includeTime: true })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn('shrink-0 font-normal', getDocumentStatusBadgeClass(document.status))}
                    >
                      {document.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Size
                      </p>
                      <p className="mt-1 text-sm font-medium">{formatFileSize(document.fileSize)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Type
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{document.mimeType}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Risk
                      </p>
                      {document.analysis ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className={cn('font-semibold tabular-nums', getRiskScoreClass(document.analysis.riskScore))}>
                              {document.analysis.riskScore}/100
                            </span>
                            <span className="text-xs text-muted-foreground">AI analysis ready</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-background">
                            <div
                              className={cn('h-full rounded-full', getRiskProgressClass(document.analysis.riskScore))}
                              style={{ width: `${document.analysis.riskScore}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Not analyzed yet</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/documents/${document.id}`}>Open</Link>
                    </Button>
                    {document.status === 'COMPLETED' && document.analysis ? (
                      <Button asChild size="sm" className="flex-1">
                        <Link href={`/documents/${document.id}#document-analysis`}>Analysis</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden border-border/80 shadow-sm md:block">
            <CardContent className="p-0">
              <div className="border-b border-border/80 bg-muted/45 px-6 py-4">
                <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(110px,0.9fr)_minmax(150px,1.1fr)_minmax(0,1fr)] gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid-cols-[minmax(0,2.5fr)_minmax(110px,0.9fr)_minmax(160px,1.1fr)_minmax(0,1.2fr)_minmax(110px,0.8fr)_minmax(180px,1.1fr)_minmax(170px,1fr)]">
                  <div>Document</div>
                  <div>Status</div>
                  <div>Risk</div>
                  <div>Type</div>
                  <div className="hidden lg:block">Size</div>
                  <div className="hidden lg:block">Uploaded</div>
                  <div className="hidden text-right lg:block">Actions</div>
                </div>
              </div>

              <div className="divide-y divide-border/70">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="group px-6 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(110px,0.9fr)_minmax(150px,1.1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2.5fr)_minmax(110px,0.9fr)_minmax(160px,1.1fr)_minmax(0,1.2fr)_minmax(110px,0.8fr)_minmax(180px,1.1fr)_minmax(170px,1fr)]">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-primary transition-colors group-hover:bg-primary/10">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start gap-2">
                              <Link
                                href={`/documents/${document.id}`}
                                className="line-clamp-2 font-medium leading-snug text-foreground underline-offset-4 hover:text-primary hover:underline"
                              >
                                {document.originalName}
                              </Link>
                              {document.analysis && document.analysis.riskScore > 70 ? (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Contract record</p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
                              <span>{formatFileSize(document.fileSize)}</span>
                              <span>{formatDate(document.createdAt, { includeTime: true })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <Badge
                          variant="secondary"
                          className={cn('font-normal', getDocumentStatusBadgeClass(document.status))}
                        >
                          {document.status}
                        </Badge>
                      </div>

                      <div>
                        {document.analysis ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={cn(
                                  'text-sm font-semibold tabular-nums',
                                  getRiskScoreClass(document.analysis.riskScore)
                                )}
                              >
                                {document.analysis.riskScore}/100
                              </span>
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Risk
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn('h-full rounded-full', getRiskProgressClass(document.analysis.riskScore))}
                                style={{ width: `${document.analysis.riskScore}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not analyzed</span>
                        )}
                      </div>

                      <div className="min-w-0 text-muted-foreground">
                        <span className="line-clamp-2">{document.mimeType}</span>
                      </div>

                      <div className="hidden text-muted-foreground lg:block">
                        {formatFileSize(document.fileSize)}
                      </div>

                      <div className="hidden text-muted-foreground lg:block">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(document.createdAt, { includeTime: true })}
                        </span>
                      </div>

                      <div className="hidden lg:block">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/documents/${document.id}`}>Open</Link>
                          </Button>
                          {document.status === 'COMPLETED' && document.analysis ? (
                            <Button asChild size="sm">
                              <Link href={`/documents/${document.id}#document-analysis`}>Analysis</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 lg:hidden">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/documents/${document.id}`}>Open</Link>
                      </Button>
                      {document.status === 'COMPLETED' && document.analysis ? (
                        <Button asChild size="sm" className="flex-1">
                          <Link href={`/documents/${document.id}#document-analysis`}>Analysis</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
