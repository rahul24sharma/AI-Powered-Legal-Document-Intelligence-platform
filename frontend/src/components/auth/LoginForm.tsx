"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { getAxiosErrorMessage } from '@/lib/api-errors';
import { LockKeyhole } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { login, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getAxiosErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <Card className="w-full overflow-hidden rounded-[2rem] border-white/70 bg-white/90 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur">
      <CardHeader className="space-y-5 border-b border-border/70 px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Welcome back
            </p>
            <CardTitle className="mt-1 text-2xl font-semibold">Sign in to ClaudeIQ</CardTitle>
          </div>
        </div>
        <CardDescription className="max-w-md text-sm leading-6">
          Access your contract intelligence workspace, recent analyses, and risk insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Secure workspace access</p>
            <p className="text-xs text-muted-foreground">Protected sign-in for legal review teams</p>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
            Encrypted
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl shadow-sm" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {`Don't have an account? `}
            <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
