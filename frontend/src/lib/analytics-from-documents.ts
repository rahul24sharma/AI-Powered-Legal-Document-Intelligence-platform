import type { Document } from '@/types';
import { parseISO, startOfISOWeek, format } from 'date-fns';

const STATUS_ORDER = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export interface WeeklyPoint {
  key: string;
  label: string;
  uploads: number;
}

export interface RiskBucket {
  label: string;
  count: number;
}

export interface WorkspaceAnalytics {
  total: number;
  totalStorageBytes: number;
  byStatus: Record<(typeof STATUS_ORDER)[number], number>;
  analyzedCount: number;
  avgRiskScore: number | null;
  elevatedRiskCount: number;
  elevatedRiskThreshold: number;
  weeklyUploads: WeeklyPoint[];
  riskBuckets: RiskBucket[];
  avgSizeBytes: number;
}

function emptyStatus(): WorkspaceAnalytics['byStatus'] {
  return {
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
}

/** Group uploads by ISO week start (stable for charts). */
export function aggregateWorkspaceAnalytics(
  documents: Document[],
  options?: { weeks?: number; elevatedRiskMin?: number }
): WorkspaceAnalytics {
  const weeks = options?.weeks ?? 12;
  const elevatedRiskThreshold = options?.elevatedRiskMin ?? 65;

  const byStatus = emptyStatus();
  let totalStorageBytes = 0;
  let analyzedCount = 0;
  let riskSum = 0;
  let elevatedRiskCount = 0;

  const weekCounts = new Map<string, number>();

  for (const doc of documents) {
    totalStorageBytes += doc.fileSize;
    byStatus[doc.status] += 1;

    const ws = startOfISOWeek(parseISO(doc.createdAt));
    const key = format(ws, 'yyyy-MM-dd');
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);

    if (doc.status === 'COMPLETED' && doc.analysis) {
      analyzedCount += 1;
      const rs = doc.analysis.riskScore;
      riskSum += rs;
      if (rs >= elevatedRiskThreshold) elevatedRiskCount += 1;
    }
  }

  const sortedWeekKeys = Array.from(weekCounts.keys()).sort();
  const tail = sortedWeekKeys.slice(-weeks);

  const weeklyUploads: WeeklyPoint[] = tail.map((key) => {
    const d = parseISO(key);
    return {
      key,
      label: format(d, 'MMM d'),
      uploads: weekCounts.get(key) ?? 0,
    };
  });

  const avgRiskScore =
    analyzedCount > 0 ? Math.round((riskSum / analyzedCount) * 10) / 10 : null;

  const riskBucketsRaw = [
    { label: 'Low', min: 0, max: 39 },
    { label: 'Moderate', min: 40, max: 64 },
    { label: 'Elevated', min: 65, max: 84 },
    { label: 'Critical', min: 85, max: 100 },
  ];

  const riskBuckets: RiskBucket[] = riskBucketsRaw.map(({ label, min, max }) => ({
    label,
    count: documents.filter(
      (d) =>
        d.status === 'COMPLETED' &&
        d.analysis &&
        d.analysis.riskScore >= min &&
        d.analysis.riskScore <= max
    ).length,
  }));

  return {
    total: documents.length,
    totalStorageBytes,
    byStatus,
    analyzedCount,
    avgRiskScore,
    elevatedRiskCount,
    elevatedRiskThreshold,
    weeklyUploads,
    riskBuckets,
    avgSizeBytes:
      documents.length > 0 ? Math.round(totalStorageBytes / documents.length) : 0,
  };
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export { STATUS_ORDER };
