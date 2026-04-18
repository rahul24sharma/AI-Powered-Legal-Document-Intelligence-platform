"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePersistHydration } from '@/hooks/usePersistHydration';

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { mounted, hydrated } = usePersistHydration();

  useEffect(() => {
    if (!mounted || !hydrated) return;

    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [mounted, hydrated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    </div>
  );
}
