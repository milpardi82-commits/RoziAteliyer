/**
 * Dashboard access gate components — shown when a user cannot access the
 * full creator dashboard (not a creator, pending, or suspended).
 *
 * Pure display components — no interactivity beyond navigation links.
 * Uses the existing design system and i18n system.
 */
import Link from 'next/link';
import { Clock, Lock, Leaf } from 'lucide-react';
import type { Dictionary, Locale } from '@/lib/i18n';

interface GateProps {
  locale: Locale;
  dict: Dictionary;
}

// ─── Not a creator gate ───────────────────────────────────────────────────────

export function NotCreatorGate({ locale, dict }: GateProps) {
  const d = dict.dashboard;
  return (
    <GateShell>
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary mx-auto">
        <Leaf size={32} />
      </div>
      <h2 className="mb-3 font-display text-2xl font-medium">{d.notCreator}</h2>
      <p className="mb-8 text-sm leading-relaxed text-muted-foreground max-w-sm">{d.notCreatorDesc}</p>
      <Link
        href={`/${locale}/become-creator`}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {d.notCreatorCta}
      </Link>
    </GateShell>
  );
}

// ─── Pending application gate ─────────────────────────────────────────────────

export function PendingCreatorGate({ dict }: { dict: Dictionary }) {
  const d = dict.dashboard;
  return (
    <GateShell>
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600 mx-auto">
        <Clock size={32} />
      </div>
      <h2 className="mb-3 font-display text-2xl font-medium">{d.pendingCreator}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">{d.pendingCreatorDesc}</p>
    </GateShell>
  );
}

// ─── Suspended creator gate ───────────────────────────────────────────────────

export function SuspendedCreatorGate({ dict }: { dict: Dictionary }) {
  const d = dict.dashboard;
  return (
    <GateShell>
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive mx-auto">
        <Lock size={32} />
      </div>
      <h2 className="mb-3 font-display text-2xl font-medium">{d.suspendedCreator}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">{d.suspendedCreatorDesc}</p>
    </GateShell>
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center py-16 px-8">
      {children}
    </div>
  );
}
