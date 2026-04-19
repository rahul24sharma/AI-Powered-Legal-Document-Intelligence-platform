"use client";

import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Database, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionIntro } from '@/components/workspace/page-header';
import type { WorkspaceAnalytics } from '@/lib/analytics-from-documents';
import { formatBytes, formatCompactNumber } from '@/lib/analytics-from-documents';
import { ChartSkeleton } from '@/components/charts/chart-skeleton';
import { cn } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--chart-4)',
  PROCESSING: 'var(--chart-3)',
  COMPLETED: 'var(--chart-2)',
  FAILED: 'var(--destructive)',
};

const RISK_BAR_FILLS = [
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--destructive)',
];

export type StatusChartRow = {
  name: string;
  raw: string;
  count: number;
};

export type RiskChartRow = {
  name: string;
  count: number;
};

export function AnalyticsChartsPanels({
  isLoading,
  stats,
  statusChartData,
  riskChartData,
}: {
  isLoading: boolean;
  stats: WorkspaceAnalytics;
  statusChartData: StatusChartRow[];
  riskChartData: RiskChartRow[];
}) {
  const volGradId = useId().replace(/:/g, '');
  const analyzedTotal = Math.max(stats.analyzedCount, 0);
  const weeklyAverage =
    stats.weeklyUploads.length > 0
      ? stats.weeklyUploads.reduce((sum, point) => sum + point.uploads, 0) / stats.weeklyUploads.length
      : 0;
  const peakWeek = stats.weeklyUploads.reduce(
    (best, point) => (point.uploads > best.uploads ? point : best),
    stats.weeklyUploads[0] ?? { label: 'n/a', uploads: 0 }
  );
  const topRiskShare =
    analyzedTotal > 0
      ? Math.round(
          (((riskChartData[2]?.count ?? 0) + (riskChartData[3]?.count ?? 0)) / analyzedTotal) * 100
        )
      : 0;
  const bandSummary = riskChartData.map((band, index) => {
    const count = band.count;
    const share = analyzedTotal > 0 ? Math.round((count / analyzedTotal) * 100) : 0;
    return {
      ...band,
      share,
      color: RISK_BAR_FILLS[index] ?? 'var(--chart-1)',
    };
  });

  return (
    <>
      <section className="space-y-5">
        <SectionIntro
          title="Trends & pipeline"
          description="Visual breakdown of volume and processing mix."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="relative overflow-hidden border-border/80 shadow-sm xl:col-span-2">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
          <div className="relative border-b border-border/70 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wide">Trend analysis</span>
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">Weekly intake trend</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Documents grouped by ISO week with average and peak markers for planning.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Weekly avg
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {isLoading ? '—' : weeklyAverage.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Peak week
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {isLoading ? '—' : formatCompactNumber(peakWeek.uploads)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="px-4 pb-6 pt-3 sm:px-6">
            {isLoading ? (
              <ChartSkeleton height={300} />
            ) : stats.weeklyUploads.length === 0 ? (
              <EmptyChart message="Upload documents to see trends over time." />
            ) : (
              <div className="h-[320px] w-full min-w-0 rounded-2xl border border-border/70 bg-gradient-to-b from-muted/25 via-background to-background p-3 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.35)]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.weeklyUploads}
                    margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id={volGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 8" stroke="var(--border)" strokeOpacity={0.55} vertical={false} />
                    <ReferenceLine
                      y={weeklyAverage}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="6 6"
                      strokeOpacity={0.5}
                      label={{
                        value: 'Avg',
                        position: 'insideTopRight',
                        fill: 'var(--muted-foreground)',
                        fontSize: 11,
                      }}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      dy={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={40}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      dx={-4}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '18px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 18px 50px -20px rgba(0,0,0,0.22)',
                        fontSize: 12,
                      }}
                      labelFormatter={(label) => `Week of ${label}`}
                      formatter={(value: number | string) => [`${value} uploads`, 'Volume']}
                    />
                    <Area
                      type="monotone"
                      dataKey="uploads"
                      stroke="var(--chart-1)"
                      strokeWidth={3}
                      fill={`url(#${volGradId})`}
                      dot={{
                        r: 3,
                        strokeWidth: 2,
                        stroke: 'var(--background)',
                        fill: 'var(--chart-1)',
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: 'var(--background)',
                        fill: 'var(--chart-1)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="uploads"
                      stroke="var(--chart-1)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={false}
                      opacity={0.9}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <div className="border-b border-border/70 px-6 py-5">
            <h3 className="text-lg font-semibold tracking-tight">Pipeline</h3>
            <p className="mt-1 text-sm text-muted-foreground">Status distribution for all files.</p>
          </div>
          <CardContent className="px-3 pb-6 pt-2">
            {isLoading ? (
              <ChartSkeleton height={280} />
            ) : stats.total === 0 ? (
              <EmptyChart message="No documents yet." className="min-h-[220px]" />
            ) : (
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartData}
                    layout="vertical"
                    margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal />
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={92}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                      contentStyle={{
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        fontSize: 12,
                      }}
                      formatter={(value: number | string) => [`${value} docs`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.raw} fill={STATUS_COLOR[entry.raw] ?? 'var(--chart-5)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          title="Risk & storage"
          description="Clause-level model scores and aggregate file footprint."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/80 shadow-sm lg:col-span-2">
          <div className="border-b border-border/70 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">Risk distribution</h3>
                  <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Completed reviews
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completed analyses grouped by composite risk score (0–100).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Elevated share
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {isLoading ? '—' : `${topRiskShare}%`}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Completed
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {isLoading ? '—' : formatCompactNumber(stats.analyzedCount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="px-4 pb-6 pt-4 sm:px-6">
            {isLoading ? (
              <ChartSkeleton height={260} />
            ) : stats.analyzedCount === 0 ? (
              <EmptyChart message="Complete at least one analysis to populate risk bands." />
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Low</span>
                    <span>Critical</span>
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-full border border-border bg-muted/40">
                    {bandSummary.map((band) => (
                      <div
                        key={band.name}
                        className="group relative flex h-full items-center justify-center transition-transform hover:scale-y-110"
                        style={{
                          width: `${band.share}%`,
                          backgroundColor: band.color,
                        }}
                      >
                        {band.count > 0 ? (
                          <span className="opacity-0 transition-opacity group-hover:opacity-100" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each segment shows how your completed analyses are distributed across the risk bands.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {bandSummary.map((band) => (
                    <div key={band.name} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />
                          <p className="text-sm font-medium">{band.name}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">{band.count}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${band.share}%`, backgroundColor: band.color }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{band.share}% of completed reviews</span>
                        <span className="tabular-nums">{band.count} docs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden border-border/80 bg-gradient-to-b from-muted/40 to-card shadow-sm">
          <div className="border-b border-border/70 px-6 py-5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" aria-hidden />
              <h3 className="text-lg font-semibold tracking-tight">Storage</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Library footprint.</p>
          </div>
          <CardContent className="flex flex-1 flex-col gap-8 px-6 py-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total stored
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {isLoading ? '—' : formatBytes(stats.totalStorageBytes)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Average file size
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {isLoading ? '—' : formatBytes(stats.avgSizeBytes)}
              </p>
            </div>
            <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
              Historical charts use upload timestamps. Risk metrics require a completed AI analysis pass.
            </p>
          </CardContent>
        </Card>
      </div>
      </section>
    </>
  );
}

function EmptyChart({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-6 py-14 text-center',
        className
      )}
    >
      <BarChart3 className="mb-3 h-11 w-11 text-muted-foreground/35" aria-hidden />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

export default AnalyticsChartsPanels;
