'use client';

/**
 * MediaProcessingIndicator — Phase 10.
 *
 * Shows a real-time processing status indicator for a design's media jobs.
 * Subscribes to job updates via useMediaProcessingStatus and renders a
 * compact badge or a retry button for failed jobs.
 *
 * Designed to be embedded alongside existing design rows in the creator
 * dashboard without modifying the DashboardDesignList layout.
 *
 * Phase 10 states displayed:
 *   idle          — no badge (no jobs queued)
 *   queued        — amber "Queued" pulsing badge
 *   processing    — blue "Optimizing image…" animated badge
 *   ready         — green "Ready" badge (auto-disappears after 5 s)
 *   failed        — red "Failed" badge with a Retry button
 *
 * The 'processing' label is now "Optimizing image…" to reflect the
 * Phase 10 WASM optimization pipeline running on the Edge Function.
 * No layout changes — existing style classes are preserved.
 *
 * RTL compatible: uses logical CSS properties.
 * No direct database mutations — all actions go through Route Handlers.
 */

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import {
  useMediaProcessingStatus,
  toDisplayStatus,
  type ProcessingDisplayStatus,
} from '@/hooks/use-media-processing-status';

// =============================================================================
// Types
// =============================================================================

interface MediaProcessingIndicatorProps {
  /** designs.id to watch */
  designId: string;
  /**
   * Whether the design already has ready assets loaded server-side.
   * Prevents flashing 'idle' before the realtime subscription catches up.
   */
  hasReadyAssets?: boolean;
  /** Compact mode: show a very small dot + label (for table rows) */
  compact?: boolean;
}

// =============================================================================
// Status configuration
// =============================================================================

type DisplayConfig = {
  label: string;
  icon:  React.ReactNode;
  cls:   string;
  pulse: boolean;
};

const DISPLAY_CONFIG: Record<ProcessingDisplayStatus, DisplayConfig> = {
  idle: {
    label: '',
    icon:  null,
    cls:   '',
    pulse: false,
  },
  uploading: {
    label: 'Uploading',
    icon:  <Loader2 size={10} className="animate-spin" />,
    cls:   'bg-violet-50 text-violet-700 border-violet-200',
    pulse: true,
  },
  queued: {
    label: 'Queued',
    icon:  <Clock size={10} />,
    cls:   'bg-amber-50 text-amber-700 border-amber-200',
    pulse: true,
  },
  processing: {
    label: 'Optimizing image…',
    icon:  <Loader2 size={10} className="animate-spin" />,
    cls:   'bg-blue-50 text-blue-700 border-blue-200',
    pulse: false,
  },
  ready: {
    label: 'Ready',
    icon:  <CheckCircle2 size={10} />,
    cls:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    pulse: false,
  },
  failed: {
    label: 'Processing Failed',
    icon:  <AlertCircle size={10} />,
    cls:   'bg-red-50 text-red-700 border-red-200',
    pulse: false,
  },
};

// =============================================================================
// Retry handler
// =============================================================================

async function triggerRetry(designId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/creator/designs/${designId}/processing-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry' }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * Processing status badge with realtime updates.
 * Renders nothing when idle and no ready assets exist.
 */
export function MediaProcessingIndicator({
  designId,
  hasReadyAssets = false,
  compact = true,
}: MediaProcessingIndicatorProps) {
  const { status, isLoading } = useMediaProcessingStatus(designId);
  const [retrying, setRetrying] = useState(false);
  const [showReady, setShowReady] = useState(true);

  const displayStatus = toDisplayStatus(status, hasReadyAssets);

  // Auto-hide the 'ready' badge after 5 seconds
  useEffect(() => {
    if (displayStatus === 'ready') {
      setShowReady(true);
      const timer = setTimeout(() => setShowReady(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowReady(true);
    }
  }, [displayStatus]);

  // Don't render anything while loading or when idle
  if (isLoading && !hasReadyAssets) return null;
  if (displayStatus === 'idle')         return null;
  if (displayStatus === 'ready' && !showReady) return null;

  const config = DISPLAY_CONFIG[displayStatus];
  if (!config.label) return null;

  const handleRetry = async () => {
    setRetrying(true);
    await triggerRetry(designId);
    setRetrying(false);
  };

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${config.cls}`}
        role="status"
        aria-label={`Processing: ${config.label}`}
      >
        {config.icon}
        {config.label}

        {displayStatus === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="ms-1 inline-flex items-center gap-0.5 text-[10px] underline hover:no-underline disabled:opacity-50"
            aria-label="Retry processing"
          >
            <RotateCcw size={9} className={retrying ? 'animate-spin' : ''} />
            {retrying ? '…' : 'Retry'}
          </button>
        )}
      </span>
    );
  }

  // Full-size variant (for design editor page)
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${config.cls}`}
      role="status"
    >
      {config.icon}
      <span>{config.label}</span>

      {displayStatus === 'failed' && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="ms-2 inline-flex items-center gap-1.5 rounded-lg border border-current px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100 disabled:opacity-50"
          aria-label="Retry media processing"
        >
          <RotateCcw size={11} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
