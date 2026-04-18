"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowUpRight,
  Brain,
  Calendar,
  GitCompare,
  RefreshCw,
  TextSearch,
  Timer,
} from "lucide-react";
import { documentsAPI } from "@/lib/api";
import { getAxiosErrorMessage } from "@/lib/api-errors";
import type { SimilarDocument, SimilarDocumentsPayload } from "@/types";
import { cn } from "@/lib/utils";
import { getRiskScoreClass } from "@/lib/document-ui";

type Props = {
  documentId: string;
};

function ScoreBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Brain;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {label}
        </span>
        <span className="tabular-nums font-medium">{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export function SimilarDocumentsSection({ documentId }: Props) {
  const [payload, setPayload] = useState<SimilarDocumentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = (await documentsAPI.getSimilarDocuments(
        documentId
      )) as SimilarDocumentsPayload;
      setPayload(data);
    } catch (e: unknown) {
      setError(getAxiosErrorMessage(e, "Could not load related documents."));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="scroll-mt-8" aria-labelledby="related-documents-heading">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <GitCompare className="h-5 w-5" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Related matters
              </span>
            </div>
            <h2 id="related-documents-heading" className="border-0 pb-0 text-xl font-semibold">
              Similar documents
            </h2>
            <CardDescription className="text-sm leading-relaxed">
              Ranked using semantic similarity, keyword overlap, recency, and hybrid fusion — not raw vector scores alone.
            </CardDescription>
            {payload?.ranking && (
              <p className="text-xs text-muted-foreground">
                Retrieved {payload.ranking.retrievalTopK} candidates · Showing top {payload.ranking.responseLimit}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Unable to load</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((k) => (
                <Card key={k} className="animate-pulse">
                  <CardHeader className="space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-muted" />
                    <div className="h-5 w-3/4 rounded-md bg-muted" />
                    <div className="h-4 w-full rounded-md bg-muted" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {!loading && !error && payload && payload.similarDocuments.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <GitCompare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No related documents yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload more files in your workspace to improve matching.
              </p>
            </div>
          )}

          {!loading && payload && payload.similarDocuments.length > 0 && (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {payload.similarDocuments.map((doc: SimilarDocument) => (
                <li key={doc.id}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold tabular-nums text-primary"
                          aria-label={`Match score ${doc.relevanceScore} percent`}
                        >
                          {doc.relevanceScore}
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2" asChild>
                          <Link href={`/documents/${doc.id}`}>
                            Open
                            <ArrowUpRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                      <div>
                        <CardTitle className="line-clamp-2 text-base leading-snug">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="hover:text-primary focus:outline-none focus-visible:underline"
                          >
                            {doc.originalName}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(doc.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {doc.analysis && (
                            <span className={cn("font-medium tabular-nums", getRiskScoreClass(doc.analysis.riskScore))}>
                              Risk {Math.round(doc.analysis.riskScore)}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {doc.rankingMethod.replace(/_/g, " ")}
                      </Badge>

                      <details className="group rounded-lg border bg-muted/40 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium outline-none [&::-webkit-details-marker]:hidden">
                          <span className="text-muted-foreground group-open:text-foreground">
                            Score breakdown
                          </span>
                        </summary>
                        <div className="mt-3 space-y-3 pb-1">
                          <ScoreBar label="Semantic (vector)" value={doc.scoreBreakdown.vector} icon={Brain} />
                          <ScoreBar label="Lexical overlap" value={doc.scoreBreakdown.keyword} icon={TextSearch} />
                          <ScoreBar label="Recency" value={doc.scoreBreakdown.recency} icon={Timer} />
                          <ScoreBar label="RRF fusion" value={doc.scoreBreakdown.hybridRank} icon={GitCompare} />
                        </div>
                      </details>

                      {doc.analysis?.overallSummary && (
                        <p className="line-clamp-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                          {doc.analysis.overallSummary}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
