/**
 * Dashboard My Designs — design management table for the creator dashboard.
 *
 * Server Component: receives pre-fetched paginated design summaries.
 * Actions (edit, submit, view) are architectural placeholders — links only.
 * No mutations implemented in Phase 6.
 *
 * Uses DesignStatusBadgeLocalized for consistent status display.
 * Phase 9: MediaProcessingIndicator added inline to design rows — realtime
 * processing status without any layout/structural changes.
 */
import Link from 'next/link';
import { ExternalLink, FileEdit, Send, Eye } from 'lucide-react';
import { DesignStatusBadgeLocalized } from '@/components/design/DesignStatusBadge';
import { MediaProcessingIndicator } from '@/components/media/MediaProcessingIndicator';
import { toPersianNumber } from '@/lib/i18n';
import type { CreatorDesignSummary } from '@/types/dashboard';
import type { Locale, Dictionary } from '@/lib/i18n';

interface Props {
  designs: CreatorDesignSummary[];
  total: number;
  hasMore: boolean;
  page: number;
  locale: Locale;
  dict: Dictionary;
  base: string;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function DesignsEmpty({ dict }: { dict: Dictionary }) {
  const d = dict.dashboard;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#f7f6f2] px-8 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <FileEdit size={24} />
      </div>
      <p className="font-semibold text-foreground">{d.designsEmpty}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {d.designsEmptyDesc}
      </p>
    </div>
  );
}

// ─── Design row action button ─────────────────────────────────────────────────

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      <Icon size={12} />
      {label}
    </Link>
  );
}

// ─── Design row ───────────────────────────────────────────────────────────────

function DesignRow({
  design,
  locale,
  dict,
  base,
}: {
  design: CreatorDesignSummary;
  locale: Locale;
  dict: Dictionary;
  base: string;
}) {
  const d = dict.dashboard;

  const updatedDate = new Date(design.updated_at).toLocaleDateString(
    locale === 'fa' ? 'fa-IR' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  );

  // Build the appropriate action links for this design's status
  // Only architectural links — no mutations in Phase 6
  const actions: { href: string; icon: React.ElementType; label: string }[] = [];

  if (design.status === 'draft') {
    actions.push({
      href: `${base}/creator/dashboard/designs/${design.id}/edit`,
      icon: FileEdit,
      label: d.actionEdit,
    });
    actions.push({
      href: `${base}/creator/dashboard/designs/${design.id}/submit`,
      icon: Send,
      label: d.actionSubmit,
    });
  } else if (design.status === 'pending_review') {
    actions.push({
      href: `${base}/creator/dashboard/designs/${design.id}`,
      icon: Eye,
      label: d.actionViewStatus,
    });
  } else if (design.status === 'published') {
    actions.push({
      href: `${base}/designs/${design.slug}`,
      icon: ExternalLink,
      label: d.actionViewPublic,
    });
  } else {
    // approved | archived
    actions.push({
      href: `${base}/creator/dashboard/designs/${design.id}`,
      icon: Eye,
      label: d.actionView,
    });
  }

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Thumbnail + title */}
      <td className="py-3 pe-4 ps-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
            {(design.thumbnail_url || design.image_url) ? (
              <img
                src={design.thumbnail_url ?? design.image_url}
                alt={design.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground/40">
                <FileEdit size={16} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{design.title}</p>
            <p className="truncate text-xs text-muted-foreground">/{design.slug}</p>
          </div>
        </div>
      </td>

      {/* Status + processing indicator */}
      <td className="py-3 pe-4">
        <div className="flex flex-col gap-1">
          <DesignStatusBadgeLocalized status={design.status} locale={locale} size="xs" />
          {/* Phase 9: realtime media processing status (client-only, compact) */}
          <MediaProcessingIndicator
            designId={design.id}
            hasReadyAssets={!!(design.thumbnail_url || design.image_url)}
            compact
          />
        </div>
      </td>

      {/* Last updated */}
      <td className="py-3 pe-4 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
        {updatedDate}
      </td>

      {/* Actions */}
      <td className="py-3 pe-0 text-end">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {actions.map((a) => (
            <ActionLink key={a.label} href={a.href} icon={a.icon} label={a.label} />
          ))}
        </div>
      </td>
    </tr>
  );
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  pageSize,
  hasMore,
  locale,
  dict,
  dashboardBase,
}: {
  page: number;
  total: number;
  pageSize: number;
  hasMore: boolean;
  locale: Locale;
  dict: Dictionary;
  dashboardBase: string;
}) {
  const d = dict.dashboard;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const fmt = (n: number) => locale === 'fa' ? toPersianNumber(n) : n;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {d.page} {fmt(page)} {d.of} {fmt(totalPages)}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={`${dashboardBase}/designs?page=${page - 1}`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors"
          >
            {d.previous}
          </Link>
        )}
        {hasMore && (
          <Link
            href={`${dashboardBase}/designs?page=${page + 1}`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors"
          >
            {d.next}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardDesignList({ designs, total, hasMore, page, locale, dict, base }: Props) {
  const d = dict.dashboard;
  const dashboardBase = `${base}/creator/dashboard`;

  if (designs.length === 0) {
    return <DesignsEmpty dict={dict} />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-[#f7f6f2]">
              <th className="py-3 pe-4 ps-4 text-start text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {d.colTitle}
              </th>
              <th className="py-3 pe-4 text-start text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {d.colStatus}
              </th>
              <th className="py-3 pe-4 text-start text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground hidden sm:table-cell">
                {d.colUpdated}
              </th>
              <th className="py-3 pe-4 text-end text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {d.colActions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {designs.map((design) => (
              <DesignRow
                key={design.id}
                design={design}
                locale={locale}
                dict={dict}
                base={base}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={20}
        hasMore={hasMore}
        locale={locale}
        dict={dict}
        dashboardBase={dashboardBase}
      />
    </div>
  );
}
