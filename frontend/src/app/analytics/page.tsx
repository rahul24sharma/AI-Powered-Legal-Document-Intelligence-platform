"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  FileStack,
  FolderOpen,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { PageHeader, SectionIntro } from '@/components/workspace/page-header';
import { MetricTile } from '@/components/workspace/metric-tile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartSkeleton } from '@/components/charts/chart-skeleton';
import {
  aggregateWorkspaceAnalytics,
  formatBytes,
  formatCompactNumber,
  STATUS_ORDER,
} from '@/lib/analytics-from-documents';
import { cn } from '@/lib/utils';
import { useDocumentsLibrary } from '@/hooks/useDocumentsLibrary';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const AnalyticsChartsPanelsLazy = dynamic(
  () => import('@/components/charts/analytics-recharts'),
  {
    loading: () => <AnalyticsChartsFallback />,
    ssr: false,
  }
);

function AnalyticsChartsFallback() {
  return (
    <>
      <section className="space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted/70" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/50" />
        </div>
        <ChartSkeleton height={340} />
      </section>
      <section className="space-y-5 pt-4">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-md bg-muted/70" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/50" />
        </div>
        <ChartSkeleton height={300} />
      </section>
    </>
  );
}

export default function AnalyticsPage() {
  const {
    documents,
    isLoading,
    isRefreshing,
    error,
    refetch,
  } = useDocumentsLibrary();

  const stats = useMemo(() => aggregateWorkspaceAnalytics(documents), [documents]);

  const statusChartData = useMemo(
    () =>
      STATUS_ORDER.map((key) => ({
        name: STATUS_LABEL[key] ?? key,
        raw: key,
        count: stats.byStatus[key],
      })),
    [stats.byStatus]
  );

  const riskChartData = useMemo(
    () =>
      stats.riskBuckets.map((b) => ({
        name: b.label,
        count: b.count,
      })),
    [stats.riskBuckets]
  );
  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  return (
    <div className="space-y-12 pb-12">
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics"
        description="Portfolio-level signals across intake velocity, pipeline health, risk concentration, and storage — grounded in your actual document library."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/documents">
                <FolderOpen className="h-4 w-4" />
                Library
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refetch}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-destructive/35 bg-destructive/[0.06] shadow-sm">
          <CardContent className="p-6">
            <p className="font-semibold text-destructive">Could not load analytics</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your connection and API configuration, then try again.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">At a glance</h2>
            <p className="text-sm text-muted-foreground">
              Live portfolio totals and risk signals from your current workspace.
            </p>
          </div>
          {!isLoading && documents.length > 0 ? (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {formatCompactNumber(stats.total)} documents indexed
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            accent="primary"
            label="Documents"
            value={isLoading ? '—' : formatCompactNumber(stats.total)}
            hint="Total files in your workspace"
            icon={FileStack}
            loading={isLoading}
          />
          <MetricTile
            accent="success"
            label="Analyzed"
            value={isLoading ? '—' : formatCompactNumber(stats.analyzedCount)}
            hint="Completed with AI analysis"
            icon={Shield}
            loading={isLoading}
          />
          <MetricTile
            accent="warning"
            label="Elevated risk"
            value={
              isLoading ? '—' : formatCompactNumber(stats.elevatedRiskCount)
            }
            hint={`Risk score ≥ ${stats.elevatedRiskThreshold}`}
            icon={AlertTriangle}
            loading={isLoading}
            valueClassName={
              stats.elevatedRiskCount > 0 ? 'text-amber-800 dark:text-amber-400' : undefined
            }
          />
          <MetricTile
            accent="neutral"
            label="Avg. risk score"
            value={
              isLoading ? '—' : stats.avgRiskScore !== null ? stats.avgRiskScore.toFixed(1) : '—'
            }
            hint={stats.analyzedCount ? 'Across completed reviews' : 'No completed analyses yet'}
            icon={Activity}
            loading={isLoading}
          />
        </div>
      </section>

      <AnalyticsChartsPanelsLazy
        isLoading={isLoading}
        stats={stats}
        statusChartData={statusChartData}
        riskChartData={riskChartData}
      />

      <section className="space-y-5">
        <SectionIntro
          title="Recent intake"
          description="Newest documents with direct links into review."
        />
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/70" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
                  <FileStack className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-semibold text-foreground">No documents yet</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Upload contracts or agreements to populate analytics and risk insights.
                </p>
                <Button asChild className="mt-8 gap-2 shadow-md">
                  <Link href="/upload">Upload document</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-6 py-3.5">Document</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Risk</th>
                      <th className="hidden px-4 py-3.5 sm:table-cell">Size</th>
                      <th className="hidden px-6 py-3.5 md:table-cell">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 10).map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-border/70 transition-colors hover:bg-muted/35"
                      >
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {doc.originalName}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="secondary" className="font-normal">
                            {STATUS_LABEL[doc.status] ?? doc.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums">
                          {doc.analysis ? (
                            <span
                              className={cn(
                                'text-muted-foreground',
                                doc.analysis.riskScore >= stats.elevatedRiskThreshold &&
                                  'font-semibold text-amber-800 dark:text-amber-400'
                              )}
                            >
                              {doc.analysis.riskScore.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3.5 tabular-nums text-muted-foreground sm:table-cell">
                          {formatBytes(doc.fileSize)}
                        </td>
                        <td className="hidden px-6 py-3.5 text-muted-foreground md:table-cell">
                          {shortDate.format(new Date(doc.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
