/**
 * Dashboard Overview — stats panel for the creator dashboard.
 *
 * Server Component: receives pre-fetched data. No client-side fetching.
 * All counts are server-computed; this component is purely presentational.
 */
import { toPersianNumber } from '@/lib/i18n';
import type { Creator } from '@/types/marketplace';
import type { CreatorDashboardStats } from '@/types/dashboard';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n';

interface Props {
  creator: Creator;
  stats: CreatorDashboardStats;
  locale: Locale;
  dict: Dictionary;
}

// ─── Individual stat card ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent = false,
  locale,
}: {
  label: string;
  value: number;
  accent?: boolean;
  locale: Locale;
}) {
  const display = locale === 'fa' ? toPersianNumber(value) : value;
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-primary/20 bg-primary/5' : 'border-border bg-[#f7f6f2]'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tracking-[-0.04em] ${accent ? 'text-primary' : 'text-foreground'}`}>
        {display}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardOverview({ creator, stats, locale, dict }: Props) {
  const d = dict.dashboard;

  const creatorSince = new Date(creator.created_at).toLocaleDateString(
    locale === 'fa' ? 'fa-IR' : 'en-US',
    { year: 'numeric', month: 'long' }
  );

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="rounded-2xl border border-border bg-[#f7f6f2] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">{d.welcomeBack}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
              {creator.display_name}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              @{creator.handle} · {d.creatorSince} {creatorSince}
            </p>
          </div>

          {/* Creator avatar */}
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center bg-primary/10 text-primary font-bold text-lg">
                {creator.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {d.overview}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label={d.totalDesigns}     value={stats.total_designs}           locale={locale} accent />
          <StatCard label={d.publishedDesigns} value={stats.published_designs}       locale={locale} />
          <StatCard label={d.draftDesigns}     value={stats.draft_designs}           locale={locale} />
          <StatCard label={d.pendingReview}    value={stats.pending_review_designs}  locale={locale} />
          <StatCard label={d.archivedDesigns}  value={stats.archived_designs}        locale={locale} />
          <StatCard label={d.totalCollections} value={stats.total_collections}       locale={locale} />
        </div>
      </div>
    </div>
  );
}
