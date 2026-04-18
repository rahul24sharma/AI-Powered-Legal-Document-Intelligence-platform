"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/** Expose when the persisted auth store has been hydrated on the client. */
export function usePersistHydration(): { mounted: boolean; hydrated: boolean } {
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsub = useAuth.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    if (useAuth.persist.hasHydrated()) {
      setHydrated(true);
    }

    void Promise.resolve(useAuth.persist.rehydrate()).finally(() => {
      if (useAuth.persist.hasHydrated()) {
        setHydrated(true);
      }
    });

    return unsub;
  }, []);

  return { mounted, hydrated };
}
