"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import { documentsAPI } from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import type { Document, SimilarDocument, SimilarDocumentsPayload } from '@/types';
import { cn, formatDate, formatFileSize } from '@/lib/utils';
import { getDocumentStatusBadgeClass, getRiskScoreClass } from '@/lib/document-ui';

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground print:text-black/60">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight text-foreground print:text-black">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground print:text-black/70">{description}</p> : null}
    </div>
  );
}

function PillList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="font-normal print:border print:bg-transparent print:text-black">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export default function DocumentReportPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [reportDocument, setReportDocument] = useState<Document | null>(null);
  const [similarDocuments, setSimilarDocuments] = useState<SimilarDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError('');

        const [documentResponse, similarResponse] = await Promise.all([
          documentsAPI.getDocument(documentId),
          documentsAPI.getSimilarDocuments(documentId).catch(() => null as SimilarDocumentsPayload | null),
        ]);

        if (cancelled) return;

        setReportDocument(documentResponse.document);
        setSimilarDocuments(similarResponse?.similarDocuments ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getAxiosErrorMessage(err, 'Failed to load report'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!reportDocument) return;
    const previousTitle = window.document.title;
    window.document.title = `ClaudeIQ Report - ${reportDocument.originalName}`;

    return () => {
      window.document.title = previousTitle;
    };
  }, [reportDocument]);

  const analysis = reportDocument?.analysis;
  const riskFactors = analysis?.riskFactors ?? [];
  const recommendations = analysis?.recommendations ?? [];
  const clauses = analysis?.clauses ?? [];

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-foreground print:bg-white print:text-black">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/documents/${documentId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to document
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-10 text-center text-muted-foreground">
              Loading report…
            </CardContent>
          </Card>
        ) : error || !reportDocument ? (
          <Alert variant="destructive" className="print:hidden">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not load report</AlertTitle>
            <AlertDescription>{error || 'Document not found'}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden border-border/70 bg-white shadow-sm print:border-0 print:shadow-none">
              <CardContent className="space-y-6 p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary print:text-black/60">
                        ClaudeIQ Executive Report
                      </p>
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground print:text-black">
                        {reportDocument.originalName}
                      </h1>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground print:text-black/70">
                        A concise legal review designed for leadership, legal ops, and fast decision-making.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className={cn('font-normal', getDocumentStatusBadgeClass(reportDocument.status))}>
                        {reportDocument.status}
                      </Badge>
                      <Badge variant="outline" className="font-normal print:border-black/20">
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatDate(reportDocument.createdAt, { includeTime: true })}
                      </Badge>
                      <Badge variant="outline" className="font-normal print:border-black/20">
                        <FileText className="mr-1 h-3 w-3" />
                        {formatFileSize(reportDocument.fileSize)}
                      </Badge>
                      <Badge variant="outline" className="font-normal print:border-black/20">
                        {reportDocument.mimeType}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
                    <div className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk score</p>
                      <p className={cn('mt-2 text-3xl font-semibold tabular-nums', getRiskScoreClass(analysis?.riskScore))}>
                        {analysis ? `${analysis.riskScore}/100` : 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Overall AI assessed risk</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Key terms</p>
                      <p className="mt-2 text-3xl font-semibold tabular-nums">{analysis?.keyTerms?.length ?? 0}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Terms extracted from the agreement</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clauses</p>
                      <p className="mt-2 text-3xl font-semibold tabular-nums">{clauses.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Clause-level findings</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!analysis ? (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Analysis is still pending</AlertTitle>
                <AlertDescription>
                  This report will populate automatically once processing completes.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <Card className="border-border/70 shadow-sm print:shadow-none">
                    <CardHeader>
                      <SectionTitle
                        eyebrow="Clause review"
                        title="Important clauses"
                        description="Short summaries of the clauses that most affect risk and negotiation."
                      />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {clauses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No clauses were extracted.</p>
                      ) : (
                        clauses.map((clause) => (
                          <div key={clause.id} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{clause.type.replace(/_/g, ' ')}</p>
                              <Badge variant="outline" className="font-normal print:border-black/20">
                                {clause.riskLevel}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{clause.explanation}</p>
                            <p className="mt-3 text-sm leading-relaxed">{clause.content}</p>
                            {clause.suggestions?.length ? (
                              <div className="mt-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Suggestions
                                </p>
                                <PillList items={clause.suggestions} />
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-sm print:shadow-none">
                    <CardHeader>
                      <SectionTitle
                        eyebrow="Top findings"
                        title="Risk factors"
                        description="The most important issues to call out in an executive review."
                      />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {riskFactors.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No risk factors were returned.</p>
                      ) : (
                        riskFactors.map((factor, index) => (
                          <div key={`${factor.factor}-${index}`} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">{factor.factor}</p>
                              <Badge variant="outline" className="font-normal print:border-black/20">
                                {factor.severity}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{factor.explanation}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/70 shadow-sm print:shadow-none">
                  <CardHeader>
                    <SectionTitle
                      eyebrow="Recommendations"
                      title="Suggested actions"
                      description="Practical next steps for the legal or business owner."
                    />
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recommendations were returned.</p>
                    ) : (
                      recommendations.map((rec, index) => (
                        <div key={`${rec.category}-${index}`} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{rec.category}</p>
                            <Badge variant="secondary" className="font-normal">
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{rec.suggestion}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <Card className="border-border/70 shadow-sm print:shadow-none">
                    <CardHeader>
                      <SectionTitle
                        eyebrow="Executive summary"
                        title="What matters most"
                        description="A concise view of the overall position and the risk posture."
                      />
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                        <p className="text-sm leading-relaxed">{analysis.overallSummary}</p>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plain language</p>
                        <p className="text-sm leading-relaxed">{analysis.plainEnglish}</p>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Risk score</span>
                          <span className={cn('text-lg font-semibold tabular-nums', getRiskScoreClass(analysis.riskScore))}>
                            {analysis.riskScore}/100
                          </span>
                        </div>
                        <Progress value={analysis.riskScore} className="h-3 print:bg-black/10" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-sm print:shadow-none">
                    <CardHeader>
                      <SectionTitle
                        eyebrow="Referenced context"
                        title="Similar documents"
                        description="Documents used for contextual comparison and precedent memory."
                      />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {similarDocuments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No similar documents were returned for this report.
                        </p>
                      ) : (
                        similarDocuments.slice(0, 3).map((doc) => (
                          <div key={doc.id} className="rounded-2xl border border-border/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium">{doc.originalName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatDate(doc.createdAt, { includeTime: false })}
                                </p>
                              </div>
                              <Badge variant="secondary" className="font-normal">
                                {doc.relevanceScore}%
                              </Badge>
                            </div>
                            {doc.analysis?.overallSummary ? (
                              <p className="mt-3 text-sm text-muted-foreground">{doc.analysis.overallSummary}</p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/70 shadow-sm print:shadow-none">
                  <CardHeader>
                    <SectionTitle
                      eyebrow="Key terms"
                      title="Extracted terms"
                      description="The vocabulary and concepts that repeatedly surfaced in the analysis."
                    />
                  </CardHeader>
                  <CardContent>
                    {analysis.keyTerms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No key terms were extracted.</p>
                    ) : (
                      <PillList items={analysis.keyTerms} />
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
