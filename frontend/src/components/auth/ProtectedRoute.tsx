"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePersistHydration } from '@/hooks/usePersistHydration';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function SessionFallback({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/** Prevent protected screens from rendering until persisted auth state is ready. */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const router = useRouter();
  const { mounted, hydrated } = usePersistHydration();

  /** Session already in memory (e.g. right after login). */
  const hasMemorySession = Boolean(user && token);
  const authReady = hydrated || hasMemorySession;

  useEffect(() => {
    if (!authReady) return;
    if (!user || !token) {
      router.replace('/login');
    }
  }, [authReady, user, token, router]);

  if (!mounted) {
    return <SessionFallback message="Loading session…" />;
  }

  if (!authReady) {
    return <SessionFallback message="Loading session…" />;
  }

  if (!user || !token) {
    return <SessionFallback message="Redirecting…" />;
  }

  return <>{children}</>;
}
