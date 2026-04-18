"use client";

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/workspace/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Mail, Shield, User } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile and session for your workspace. Preferences apply on this device."
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Information from your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-4 rounded-xl border border-border/80 bg-muted/30 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
              <User className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{user?.name ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-border/80 bg-muted/30 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
              <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="break-all font-medium text-foreground">{user?.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-border/80 bg-muted/30 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
              <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
              <p className="font-medium text-foreground">{user?.role ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Session</CardTitle>
          <CardDescription>Sign out on this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
