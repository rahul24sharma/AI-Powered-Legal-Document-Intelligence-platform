'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/40">
        <Navbar />
        <div className="mx-auto flex max-w-[1600px]">
          <Sidebar />
          <main className="min-h-[calc(100vh-3.5rem)] flex-1 min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
