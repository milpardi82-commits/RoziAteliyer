/**
 * DesignStatusBadge — displays the current lifecycle status of a design.
 *
 * Used in the creator's design management view (future dashboard).
 * Pure display component — no interactivity. Matches existing design system.
 *
 * Statuses: draft | pending_review | approved | published | archived
 */
import type { DesignStatus } from '@/types/design';

interface Props {
  status: DesignStatus;
  /** Optional size variant. Default is 'sm'. */
  size?: 'xs' | 'sm';
}

const STATUS_CONFIG: Record<
  DesignStatus,
  { label: string; labelFa: string; color: string }
> = {
  draft:          { label: 'Draft',          labelFa: 'پیش‌نویس',       color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  pending_review: { label: 'Under Review',   labelFa: 'در بررسی',        color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:       { label: 'Approved',       labelFa: 'تأیید شده',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  published:      { label: 'Published',      labelFa: 'منتشر شده',       color: 'bg-primary/10 text-primary border-primary/20' },
  archived:       { label: 'Archived',       labelFa: 'بایگانی',         color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export function DesignStatusBadge({ status, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['draft'];
  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.1em] ${sizeClass} ${config.color}`}
      title={config.label}
    >
      {/* The label shown depends on which is relevant; here we expose both as data attrs */}
      <span data-en={config.label} data-fa={config.labelFa}>
        {config.label}
      </span>
    </span>
  );
}

/**
 * RTL-aware version that accepts a locale and shows the appropriate label.
 */
export function DesignStatusBadgeLocalized({
  status,
  locale,
  size = 'sm',
}: Props & { locale: 'fa' | 'en' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['draft'];
  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.1em] ${sizeClass} ${config.color}`}
    >
      {locale === 'fa' ? config.labelFa : config.label}
    </span>
  );
}
