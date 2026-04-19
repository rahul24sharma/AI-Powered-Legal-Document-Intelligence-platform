"use client";

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');

  useEffect(() => {
    if (pathname.startsWith('/documents')) {
      setSearchValue(searchParams.get('q') || '');
    } else {
      setSearchValue('');
    }
  }, [pathname, searchParams]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchValue.trim();
    router.push(query ? `/documents?q=${encodeURIComponent(query)}` : '/documents');
  };

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

        <form onSubmit={handleSearch} className="hidden min-w-0 flex-[0_1_22rem] lg:flex">
          <label className="flex w-full items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search documents"
              aria-label="Search documents"
            />
          </label>
        </form>

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
