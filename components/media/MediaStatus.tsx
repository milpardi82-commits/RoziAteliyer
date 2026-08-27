'use client';

/**
 * MediaStatus — displays the processing lifecycle status of a media asset.
 *
 * Used in the creator's design editor and dashboard to show media processing
 * progress. Pure display component — no interactivity.
 *
 * Supports all MediaAssetStatus values:
 *   pending    → amber "Queued" badge
 *   processing → blue animated "Processing" badge
 *   ready      → green "Ready" badge
 *   failed     → red "Failed" badge with optional retry hint
 *   deleted    → gray "Deleted" badge (rarely shown)
 *
 * RTL compatible: uses logical CSS properties (start/end) everywhere.
 * Loading state: renders a skeleton when status is undefined or null.
 * Error state: renders a "Failed" badge when status='failed'.
 * Empty state: renders nothing when no status is provided and showEmpty=true.
 */

import type { MediaAssetStatus, MediaAssetType } from '@/types/media';

// =============================================================================
// Types
// =============================================================================

interface MediaStatusProps {
  /** The current lifecycle status of the asset */
  status: MediaAssetStatus | null | undefined;
  /** Optional: the asset type for richer labels */
  assetType?: MediaAssetType;
  /** Show a skeleton placeholder while status is loading */
  loading?: boolean;
  /** Show nothing when status is null/undefined (default: show skeleton) */
  showEmpty?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Include an icon alongside the label */
  showIcon?: boolean;
}

// =============================================================================
// Status configuration
// =============================================================================

type StatusConfig = {
  label: string;
  labelFa: string;
  color: string;
  dot: string;
  icon: string;
  animate?: boolean;
};

const STATUS_CONFIG: Record<MediaAssetStatus, StatusConfig> = {
  pending: {
    label:   'Queued',
    labelFa: 'در صف',
    color:   'bg-amber-50 text-amber-700 border-amber-200',
    dot:     'bg-amber-400',
    icon:    '⏳',
  },
  processing: {
    label:   'Processing',
    labelFa: 'در حال پردازش',
    color:   'bg-blue-50 text-blue-700 border-blue-200',
    dot:     'bg-blue-500',
    icon:    '⚙️',
    animate: true,
  },
  ready: {
    label:   'Ready',
    labelFa: 'آماده',
    color:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot:     'bg-emerald-500',
    icon:    '✓',
  },
  failed: {
    label:   'Failed',
    labelFa: 'ناموفق',
    color:   'bg-red-50 text-red-700 border-red-200',
    dot:     'bg-red-500',
    icon:    '✕',
  },
  deleted: {
    label:   'Deleted',
    labelFa: 'حذف شده',
    color:   'bg-gray-100 text-gray-500 border-gray-200',
    dot:     'bg-gray-400',
    icon:    '—',
  },
};

const TYPE_LABEL: Record<MediaAssetType, { en: string; fa: string }> = {
  original:  { en: 'Original',  fa: 'اصل' },
  preview:   { en: 'Preview',   fa: 'پیش‌نمایش' },
  thumbnail: { en: 'Thumbnail', fa: 'تصویر کوچک' },
};

// =============================================================================
// Component
// =============================================================================

/**
 * MediaStatus badge — shows the current processing lifecycle state.
 *
 * @example
 * // Simple status badge
 * <MediaStatus status="ready" />
 *
 * // With asset type label
 * <MediaStatus status="processing" assetType="preview" showIcon />
 *
 * // Loading skeleton
 * <MediaStatus status={null} loading />
 */
export function MediaStatus({
  status,
  assetType,
  loading = false,
  showEmpty = false,
  size = 'sm',
  showIcon = false,
}: MediaStatusProps) {
  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading || (status === null && !showEmpty)) {
    return (
      <span
        className={`inline-flex animate-pulse rounded-full border border-transparent bg-muted ${sizeClass(size, true)}`}
        aria-label="Loading status"
        role="status"
      />
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!status) {
    if (showEmpty) return null;
    return null;
  }

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const textSize = size === 'xs' ? 'text-[10px]' : size === 'md' ? 'text-[13px]' : 'text-[11px]';
  const padding  = size === 'xs' ? 'px-1.5 py-0.5' : size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${textSize} ${padding} ${config.color}`}
      role="status"
      aria-label={`${assetType ? TYPE_LABEL[assetType]?.en + ' ' : ''}${config.label}`}
    >
      {/* Status indicator dot */}
      <span
        className={`h-1.5 w-1.5 flex-none rounded-full ${config.dot} ${
          config.animate ? 'animate-pulse' : ''
        }`}
        aria-hidden="true"
      />

      {/* Optional asset type prefix */}
      {assetType && (
        <span className="opacity-60" aria-hidden="true">
          {TYPE_LABEL[assetType]?.en}·
        </span>
      )}

      {/* Status label */}
      {config.label}

      {/* Optional icon */}
      {showIcon && (
        <span aria-hidden="true" className="text-[0.9em]">
          {config.icon}
        </span>
      )}
    </span>
  );
}

/**
 * MediaStatusRow — renders a compact row with an asset type label + status badge.
 *
 * Designed for the design editor sidebar's "Media Assets" section.
 *
 * @example
 * <MediaStatusRow assetType="original" status="ready" />
 * <MediaStatusRow assetType="preview" status="processing" />
 * <MediaStatusRow assetType="thumbnail" status={null} loading />
 */
export function MediaStatusRow({
  assetType,
  status,
  loading = false,
}: {
  assetType: MediaAssetType;
  status: MediaAssetStatus | null | undefined;
  loading?: boolean;
}) {
  const typeInfo = TYPE_LABEL[assetType];

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground">{typeInfo.en}</span>
      <MediaStatus
        status={status}
        assetType={assetType}
        loading={loading}
        showEmpty
        size="xs"
      />
    </div>
  );
}

/**
 * MediaStatusStack — shows all three asset type statuses in a vertical stack.
 *
 * Used in the design editor sidebar and the creator's design detail view.
 */
export function MediaStatusStack({
  originalStatus,
  previewStatus,
  thumbnailStatus,
  loading = false,
}: {
  originalStatus:  MediaAssetStatus | null;
  previewStatus:   MediaAssetStatus | null;
  thumbnailStatus: MediaAssetStatus | null;
  loading?: boolean;
}) {
  return (
    <div
      className="divide-y divide-border rounded-xl border border-border bg-card px-3 py-2"
      role="list"
      aria-label="Media processing status"
    >
      <div role="listitem">
        <MediaStatusRow assetType="original"  status={originalStatus}  loading={loading} />
      </div>
      <div role="listitem">
        <MediaStatusRow assetType="preview"   status={previewStatus}   loading={loading} />
      </div>
      <div role="listitem">
        <MediaStatusRow assetType="thumbnail" status={thumbnailStatus} loading={loading} />
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function sizeClass(size: 'xs' | 'sm' | 'md', isBlock = false): string {
  const h = size === 'xs' ? 'h-4' : size === 'md' ? 'h-7' : 'h-5';
  const w = isBlock ? (size === 'xs' ? 'w-16' : 'w-20') : '';
  return `${h} ${w}`.trim();
}
