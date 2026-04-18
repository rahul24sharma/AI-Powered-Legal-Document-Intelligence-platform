"use client";

import { useId } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
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
    <div className="h-[260px] w-full min-w-0 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weeklyUploads} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
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
            width={32}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              boxShadow: '0 10px 40px -12px rgba(0,0,0,0.15)',
              fontSize: 12,
            }}
            labelFormatter={(label) => `Week of ${label}`}
            formatter={(v: number | string) => [`${v} uploads`, 'Volume']}
          />
          <Area
            type="monotone"
            dataKey="uploads"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
