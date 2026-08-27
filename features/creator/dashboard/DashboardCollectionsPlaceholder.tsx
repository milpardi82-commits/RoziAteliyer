/**
 * Collections placeholder — shown in the Collections tab for Phase 6.
 * Full collection management is a future task.
 */
import type { Dictionary } from '@/lib/i18n';

export function DashboardCollectionsPlaceholder({ dict }: { dict: Dictionary }) {
  const d = dict.dashboard;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#f7f6f2] px-8 py-20 text-center">
      <p className="font-semibold text-foreground">{d.collectionsComingSoon}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {d.collectionsComingSoonDesc}
      </p>
    </div>
  );
}
