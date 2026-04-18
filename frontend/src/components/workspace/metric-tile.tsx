"use client";

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const accents = {
  neutral: 'before:bg-muted-foreground/45',
  primary: 'before:bg-primary',
  success: 'before:bg-emerald-600 dark:before:bg-emerald-500',
  warning: 'before:bg-amber-500',
  danger: 'before:bg-destructive',
} as const;

export type MetricAccent = keyof typeof accents;

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  accent = 'neutral',
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  loading?: boolean;
  accent?: MetricAccent;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm',
        'before:pointer-events-none before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full',
        accents[accent],
        'transition-shadow duration-200 hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground transition-colors group-hover:bg-muted">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" aria-label="Loading" />
        ) : (
          <p
            className={cn(
              'font-semibold tabular-nums tracking-tight text-foreground',
              'text-3xl sm:text-[2rem] sm:leading-none',
              valueClassName
            )}
          >
            {value}
          </p>
        )}
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
