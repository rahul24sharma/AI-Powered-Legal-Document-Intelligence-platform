import type { Document, SimilarDocumentsPayload, User } from '@/types';
import { clearPersistedAuth, getStoredToken } from '@/lib/auth-storage';

// Default matches backend/.env PORT=5050 when NEXT_PUBLIC_API_URL is unset
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api';

type AuthResponse = {
  token: string;
  user: User;
};

type DocumentsResponse = {
  documents: Document[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  summary?: {
    totalDocuments: number;
    analyzedCount: number;
    elevatedRiskCount: number;
  };
};

type DocumentResponse = {
  document: Document;
};

type DocumentStatusResponse = {
  status: {
    id: string;
    state: Document['status'];
    analysisReady: boolean;
    updatedAt: string;
  };
};

type UploadResponse = {
  message: string;
  document: {
    id: string;
    filename: string;
    status: string;
  };
};

type CancelDocumentResponse = {
  message: string;
  document: Document;
};

export class APIError extends Error {
  status?: number;
  code?: string;
  url: string;
  data?: unknown;

  constructor(message: string, opts: { status?: number; code?: string; url: string; data?: unknown }) {
    super(message);
    this.name = 'APIError';
    this.status = opts.status;
    this.code = opts.code;
    this.url = opts.url;
    this.data = opts.data;
  }
}

/** Send one authenticated API request and normalize HTTP/network failures. */
async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getStoredToken();

  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 10000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });

    let data: unknown = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text || null;
    }

    const isLoginOrRegister = path.includes('/auth/login') || path.includes('/auth/register');
    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined' && !isLoginOrRegister) {
        clearPersistedAuth();
        window.location.href = '/login';
      }
      throw new APIError('Request failed', {
        status: response.status,
        url: path,
        data,
      });
    }

    return data as T;
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new APIError('Request timed out', { code: 'ERR_TIMEOUT', url: path });
    }
    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new APIError(message, { code: 'ERR_NETWORK', url: path });
  } finally {
    clearTimeout(timeout);
  }
}

// API functions
export const authAPI = {
  /** Exchange credentials for a JWT-backed session payload. */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /** Create a user account and start an authenticated session immediately. */
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },
};

export const documentsAPI = {
  /** Fetch the current user's document list. */
  getDocuments: async (params?: { page?: number; limit?: number; q?: string }): Promise<DocumentsResponse> => {
    const query = new URLSearchParams();
    if (typeof params?.page === 'number') query.set('page', String(params.page));
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    const path = query.toString() ? `/documents?${query.toString()}` : '/documents';
    return request<DocumentsResponse>(path);
  },

  /** Fetch one document and its attached analysis payload. */
  getDocument: async (id: string): Promise<DocumentResponse> => {
    return request<DocumentResponse>(`/documents/${id}`);
  },

  /** Fetch lightweight processing state for a document detail page. */
  getDocumentStatus: async (id: string): Promise<DocumentStatusResponse> => {
    return request<DocumentStatusResponse>(`/documents/${id}/status`, {
      timeoutMs: 15000,
    });
  },

  /** Fetch related documents for the current document. */
  getSimilarDocuments: async (id: string): Promise<SimilarDocumentsPayload> => {
    return request<SimilarDocumentsPayload>(`/documents/${id}/similar`, {
      timeoutMs: 120000,
    });
  },

  /** Upload one file for background processing. */
  uploadDocument: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('document', file);

    return request<UploadResponse>('/upload', {
      method: 'POST',
      body: formData,
    });
  },

  /** Cancel an in-progress document review. */
  cancelDocumentProcessing: async (id: string): Promise<CancelDocumentResponse> => {
    return request<CancelDocumentResponse>(`/documents/${id}/cancel`, {
      method: 'POST',
    });
  },

  subscribeToDocumentStatus: (
    id: string,
    handlers: {
      onMessage: (payload: unknown) => void;
      onError?: () => void;
    }
  ) => {
    let closed = false;

    /** Poll the document endpoint until processing reaches a terminal state. */
    const emitLatest = async () => {
      try {
        const data = await request<DocumentStatusResponse>(`/documents/${id}/status`, {
          timeoutMs: 15000,
        });
        if (!closed) handlers.onMessage(data);
      } catch {
        if (!closed) handlers.onError?.();
      }
    };

    void emitLatest();

    const interval = window.setInterval(() => {
      void emitLatest();
    }, 2000);

    return () => {
      closed = true;
      window.clearInterval(interval);
    };
  },
};
