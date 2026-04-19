"use client";

import { useId } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WeeklyPoint } from '@/lib/analytics-from-documents';

export default function DashboardThroughputChart({
  weeklyUploads,
  isLoading,
}: {
  weeklyUploads: WeeklyPoint[];
  isLoading: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const avgUploads =
    weeklyUploads.length > 0
      ? weeklyUploads.reduce((sum, point) => sum + point.uploads, 0) / weeklyUploads.length
      : 0;
  const latestPoint = weeklyUploads[weeklyUploads.length - 1];

  if (isLoading) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (weeklyUploads.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
        <BarChart3 className="mb-3 h-11 w-11 text-muted-foreground/35" aria-hidden />
        <p className="font-medium text-foreground">No trend data yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Upload documents to populate this chart with weekly volume.
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link href="/upload">Upload a document</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{avgUploads.toFixed(1)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest week</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{latestPoint?.uploads ?? 0}</p>
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-muted/10 to-background p-3 shadow-[0_10px_30px_-22px_rgba(0,0,0,0.35)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyUploads} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 8" stroke="var(--border)" strokeOpacity={0.45} vertical={false} />
            <ReferenceLine
              y={avgUploads}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 6"
              strokeOpacity={0.45}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '18px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 16px 44px -16px rgba(0,0,0,0.18)',
                fontSize: 12,
              }}
              labelFormatter={(label) => `Week of ${label}`}
              formatter={(v: number | string) => [`${v} uploads`, 'Volume']}
            />
            <Area
              type="monotone"
              dataKey="uploads"
              stroke="var(--chart-1)"
              strokeWidth={3}
              fill={`url(#${gradId})`}
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
            <Line type="monotone" dataKey="uploads" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
