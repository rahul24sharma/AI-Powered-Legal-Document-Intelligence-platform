import { AlertTriangle, CheckCircle, FileText, RefreshCw, type LucideIcon } from 'lucide-react';

/** Map backend document statuses to badge colors used across document screens. */
export function getDocumentStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400';
    case 'PROCESSING':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-400';
    case 'FAILED':
      return 'bg-destructive/15 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/** Return the icon that best communicates the current processing status. */
export function getDocumentStatusIcon(status: string): LucideIcon {
  switch (status) {
    case 'COMPLETED':
      return CheckCircle;
    case 'PROCESSING':
      return RefreshCw;
    case 'FAILED':
      return AlertTriangle;
    default:
      return FileText;
  }
}

/** Use the same visual risk scale everywhere a numeric risk score is shown. */
export function getRiskScoreClass(score: number | undefined): string {
  if (score == null) return 'text-muted-foreground';
  if (score > 70) return 'text-destructive';
  if (score > 40) return 'text-amber-600 dark:text-amber-500';
  return 'text-emerald-600 dark:text-emerald-400';
}

/** Match the progress bar fill color to the numeric risk scale. */
export function getRiskProgressClass(score: number): string {
  if (score > 70) return 'bg-destructive';
  if (score > 40) return 'bg-amber-500';
  return 'bg-emerald-500';
}
