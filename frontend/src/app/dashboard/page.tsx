"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  FileText,
  FolderOpen,
  Scale,
  Shield,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { ChartSkeleton } from '@/components/charts/chart-skeleton';
import { PageHeader } from '@/components/workspace/page-header';
import { MetricTile } from '@/components/workspace/metric-tile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aggregateWorkspaceAnalytics, formatCompactNumber } from '@/lib/analytics-from-documents';
import { cn } from '@/lib/utils';
import { useDocumentsLibrary } from '@/hooks/useDocumentsLibrary';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const DashboardThroughputChart = dynamic(
  () => import('@/components/charts/dashboard-throughput-chart'),
  {
    loading: () => <ChartSkeleton height={260} />,
    ssr: false,
  }
);

export default function DashboardPage() {
  const { documents, isLoading } = useDocumentsLibrary();

  const stats = useMemo(() => aggregateWorkspaceAnalytics(documents), [documents]);

  const queueCount = stats.byStatus.PENDING + stats.byStatus.PROCESSING;

  const recent = useMemo(() => documents.slice(0, 6), [documents]);
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
    <div className="space-y-10 pb-10">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Monitor intake, AI review throughput, and risk concentration across your legal documents in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/documents">
                <FolderOpen className="h-4 w-4" />
                Browse library
              </Link>
            </Button>
            <Button size="sm" className="gap-2 shadow-sm" asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4" />
                New upload
              </Link>
            </Button>
          </div>
        }
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">At a glance</h2>
            <p className="text-sm text-muted-foreground">Live counts from your workspace library.</p>
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
            icon={FileText}
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
            value={isLoading ? '—' : formatCompactNumber(stats.elevatedRiskCount)}
            hint={`Risk score ≥ ${stats.elevatedRiskThreshold}`}
            icon={Scale}
            loading={isLoading}
            valueClassName={
              stats.elevatedRiskCount > 0 ? 'text-amber-800 dark:text-amber-400' : undefined
            }
          />
          <MetricTile
            accent="neutral"
            label="In queue"
            value={isLoading ? '—' : formatCompactNumber(queueCount)}
            hint="Pending or processing"
            icon={Zap}
            loading={isLoading}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="relative overflow-hidden border-border/80 shadow-sm lg:col-span-7">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="relative border-b border-border/70 px-6 py-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Throughput</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Upload cadence</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Weekly intake trend — spot spikes in contract volume early.
            </p>
          </div>
          <CardContent className="px-4 pb-6 pt-2 sm:px-6">
            <DashboardThroughputChart weeklyUploads={stats.weeklyUploads} isLoading={isLoading} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card className="flex-1 border-border/80 shadow-sm">
            <div className="border-b border-border/70 px-6 py-5">
              <h3 className="text-lg font-semibold tracking-tight">Shortcuts</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Jump to the workflows you use most.
              </p>
            </div>
            <CardContent className="flex flex-col gap-2 px-3 py-4 sm:px-4">
              <ShortcutRow
                href="/documents"
                icon={FolderOpen}
                title="Document library"
                subtitle="Search, filter, and open analyses"
              />
              <ShortcutRow
                href="/analytics"
                icon={BarChart3}
                title="Analytics"
                subtitle="Risk bands, pipeline mix, and storage"
              />
              <ShortcutRow
                href="/upload"
                icon={Upload}
                title="Upload center"
                subtitle="PDF & Word intake with AI processing"
              />
            </CardContent>
          </Card>

          <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">Deep-dive metrics</p>
                <p className="text-sm text-muted-foreground">
                  Explore distribution charts, risk histograms, and recent intake detail.
                </p>
              </div>
              <Button variant="secondary" className="shrink-0 gap-2 shadow-sm" asChild>
                <Link href="/analytics">
                  Open analytics
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Recent documents</h2>
          <p className="text-sm text-muted-foreground">
            Latest uploads — newest listed first.
          </p>
        </div>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/70" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
                <FileText className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-lg font-semibold text-foreground">Your workspace is ready</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Upload agreements, NDAs, or amendments to generate summaries, clause risk, and similarity
                matches.
              </p>
              <Button asChild className="mt-8 gap-2 shadow-md">
                <Link href="/upload">
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/80">
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="group flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/90 text-muted-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{doc.originalName}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {shortDate.format(new Date(doc.createdAt))}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <Badge variant="secondary" className="font-normal">
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                      {doc.analysis ? (
                        <span
                          className={cn(
                            'tabular-nums text-sm text-muted-foreground',
                            doc.analysis.riskScore >= stats.elevatedRiskThreshold &&
                              'font-medium text-amber-800 dark:text-amber-400'
                          )}
                        >
                          Risk {doc.analysis.riskScore.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No score yet</span>
                      )}
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100 sm:block" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function ShortcutRow({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-muted/50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/90 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}
