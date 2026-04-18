"use client";

import { useCallback, useEffect, useState } from 'react';
import { documentsAPI } from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import type { Document } from '@/types';

/** Load and refresh the current user's document library without a global query client. */
export function useDocumentsLibrary() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError('');
      const response = await documentsAPI.getDocuments();
      setDocuments(response.documents);
    } catch (err: unknown) {
      setError(getAxiosErrorMessage(err, 'Failed to fetch documents'));
    } finally {
      if (mode === 'initial') {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    isLoading,
    isRefreshing,
    error,
    refetch: () => fetchDocuments('refresh'),
  };
}
