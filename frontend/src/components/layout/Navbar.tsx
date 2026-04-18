"use client";

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const MobileNavLazy = dynamic(
  () => import('@/components/layout/MobileNav').then((mod) => mod.MobileNav),
  {
    loading: () => (
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 lg:hidden"
        aria-label="Open menu"
        disabled
      />
    ),
  }
);

const NavbarAccountMenuLazy = dynamic(
  () => import('@/components/layout/NavbarAccountMenu').then((mod) => mod.NavbarAccountMenu),
  {
    loading: () => (
      <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" disabled />
    ),
  }
);

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
        <MobileNavLazy />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/dashboard"
            className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            ClaudeIQ
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Contract Intelligence
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:inline">
            {user?.name}
          </span>

          <NavbarAccountMenuLazy />
        </div>
      </div>
    </header>
  );
}
