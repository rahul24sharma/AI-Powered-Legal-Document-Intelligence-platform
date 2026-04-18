"use client";

import { Loader2 } from 'lucide-react';

export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex w-full animate-pulse items-center justify-center rounded-xl bg-muted/60"
      style={{ height }}
    >
      <Loader2 className="h-9 w-9 animate-spin text-muted-foreground/45" aria-hidden />
    </div>
  );
}
