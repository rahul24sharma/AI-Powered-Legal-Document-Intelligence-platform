import { BrainCircuit, FileSearch, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(72,92,255,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(44,122,99,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,249,252,1),_rgba(240,243,249,1))]">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,rgba(71,85,105,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(71,85,105,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:px-8 lg:py-8">
        <section className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(239,244,255,0.72))] p-6 shadow-[0_24px_80px_rgba(30,41,59,0.12)] backdrop-blur xl:p-8">
          <div className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              ClaudeIQ
            </div>

            <div className="max-w-xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Contract Intelligence for modern legal teams.
              </h1>
              <p className="max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                Review agreements faster, surface clause risk earlier, and turn dense legal language
                into actionable guidance inside one secure workspace.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={FileSearch}
                title="Clause review"
                description="Detect key terms, obligations, and risky language across uploaded documents."
              />
              <FeatureCard
                icon={BrainCircuit}
                title="Contextual AI"
                description="Compare related contracts and generate clear summaries your team can act on."
              />
              <FeatureCard
                icon={ShieldCheck}
                title="Secure workspace"
                description="Keep legal review inside one branded, authenticated environment."
              />
            </div>
          </div>

          <div className="relative mt-8 grid gap-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5 shadow-sm sm:grid-cols-3">
            <Stat label="Review flow" value="Faster" />
            <Stat label="Risk visibility" value="Sharper" />
            <Stat label="Workspace access" value="Secure" />
          </div>
        </section>

        <div className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-lg">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
