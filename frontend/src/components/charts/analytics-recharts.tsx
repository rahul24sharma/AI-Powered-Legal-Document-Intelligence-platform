"use client";

import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Database, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionIntro } from '@/components/workspace/page-header';
import type { WorkspaceAnalytics } from '@/lib/analytics-from-documents';
import { formatBytes } from '@/lib/analytics-from-documents';
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

  return (
    <>
      <section className="space-y-5">
        <SectionIntro
          title="Trends & pipeline"
          description="Visual breakdown of volume and processing mix."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="relative overflow-hidden border-border/80 shadow-sm xl:col-span-2">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/[0.05] blur-3xl" />
          <div className="relative border-b border-border/70 px-6 py-5">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Volume</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Upload cadence</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Documents added per ISO week — useful for capacity planning.
            </p>
          </div>
          <CardContent className="px-4 pb-6 pt-2 sm:px-6">
            {isLoading ? (
              <ChartSkeleton height={300} />
            ) : stats.weeklyUploads.length === 0 ? (
              <EmptyChart message="Upload documents to see trends over time." />
            ) : (
              <div className="h-[300px] w-full min-w-0 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.weeklyUploads}
                    margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id={volGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      width={36}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        boxShadow: '0 12px 40px -12px rgba(0,0,0,0.18)',
                        fontSize: 12,
                      }}
                      labelFormatter={(label) => `Week of ${label}`}
                      formatter={(value: number | string) => [`${value} uploads`, 'Volume']}
                    />
                    <Area
                      type="monotone"
                      dataKey="uploads"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      fill={`url(#${volGradId})`}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
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
            <h3 className="text-lg font-semibold tracking-tight">Risk distribution</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed analyses grouped by composite risk score (0–100).
            </p>
          </div>
          <CardContent className="px-4 pb-6 pt-4 sm:px-6">
            {isLoading ? (
              <ChartSkeleton height={260} />
            ) : stats.analyzedCount === 0 ? (
              <EmptyChart message="Complete at least one analysis to populate risk bands." />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={36}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        fontSize: 12,
                      }}
                      formatter={(value: number | string) => [`${value} docs`, 'In band']}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={36}>
                      {riskChartData.map((entry, i) => (
                        <Cell key={entry.name} fill={RISK_BAR_FILLS[i] ?? 'var(--chart-1)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
