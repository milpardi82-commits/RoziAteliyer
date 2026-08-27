'use client';

/**
 * useMediaProcessingStatus — Phase 9.
 *
 * Client-side Supabase Realtime hook that subscribes to processing job
 * state changes for a given design. Creators see live status updates
 * (Queued → Processing → Ready / Failed) without refreshing the page.
 *
 * Architecture:
 *   - Subscribes to changes on the `media_processing_jobs` table
 *     filtered by design_id.
 *   - Also subscribes to `media_assets` changes to detect when assets
 *     transition to 'ready'.
 *   - Uses the browser anon client (auth-client) — RLS `creator_read_own_jobs`
 *     ensures creators only receive their own rows.
 *   - Cleans up subscriptions automatically on unmount or designId change.
 *
 * Usage:
 *   const { status, isLoading, error } = useMediaProcessingStatus(designId);
 *
 * Returns:
 *   status    — current rolled-up DesignProcessingStatus (or null while loading)
 *   isLoading — true on first load before initial data arrives
 *   error     — error string if subscription fails
 *   refetch   — manually re-fetch the current state (for retry UI)
 *
 * Security:
 *   - Never mutates the database.
 *   - Reads only: SELECT via Supabase Realtime channel.
 *   - Row-level filtering: channel is design_id scoped.
 *   - RLS `creator_read_own_jobs` prevents cross-creator data leakage.
 *   - No service-role or sensitive keys are used client-side.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';
import type {
  MediaProcessingJob,
  ProcessingJobStatus,
  DesignProcessingStatus,
  ProcessingJobType,
} from '@/types/media-queue';

// =============================================================================
// Types
// =============================================================================

export type UseMediaProcessingStatusResult = {
  /** Rolled-up processing status for the design, null while loading */
  status:    DesignProcessingStatus | null;
  /** True until the initial fetch completes */
  isLoading: boolean;
  /** Error message if the subscription or fetch fails */
  error:     string | null;
  /** Manually re-fetch current status (e.g. after a retry action) */
  refetch:   () => void;
};

/**
 * Display label for the rolled-up status.
 * Used in status indicator components throughout the creator dashboard.
 */
export type ProcessingDisplayStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'idle';

// =============================================================================
// Status mapping helper
// =============================================================================

/**
 * Map a DesignProcessingStatus to a simple display status for UI components.
 * This collapses the per-job details into a single user-facing label.
 */
export function toDisplayStatus(
  status: DesignProcessingStatus | null,
  hasReadyAssets = false
): ProcessingDisplayStatus {
  if (!status || status.overallStatus === 'idle') {
    return hasReadyAssets ? 'ready' : 'idle';
  }

  switch (status.overallStatus) {
    case 'queued':     return 'queued';
    case 'processing': return 'processing';
    case 'completed':  return 'ready';
    case 'failed':     return 'failed';
    default:           return 'idle';
  }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Subscribe to realtime processing status updates for a design.
 *
 * @param designId - designs.id to watch (null/undefined to disable)
 */
export function useMediaProcessingStatus(
  designId: string | null | undefined
): UseMediaProcessingStatusResult {
  const [status,    setStatus]    = useState<DesignProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Stable ref for the channel so we can unsubscribe on cleanup
  const channelRef = useRef<ReturnType<typeof supabaseAuthClient>['channel'] extends ((...args: any[]) => infer R) ? R : never | null>(null as any);

  // ---------------------------------------------------------------------------
  // Initial fetch — load current state from the DB
  // ---------------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    if (!designId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = supabaseAuthClient();

      const { data, error: dbError } = await (db.from('media_processing_jobs') as any)
        .select('*')
        .eq('design_id', designId)
        .order('created_at', { ascending: false });

      if (dbError) {
        setError(dbError.message);
        setIsLoading(false);
        return;
      }

      const jobs = (data ?? []) as MediaProcessingJob[];
      setStatus(buildDesignStatus(designId, jobs));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch_failed');
    } finally {
      setIsLoading(false);
    }
  }, [designId]);

  // ---------------------------------------------------------------------------
  // Realtime subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!designId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    // Initial load
    fetchStatus();

    const db      = supabaseAuthClient();
    const channel = db.channel(`media-jobs-${designId}`, {
      config: {
        broadcast: { ack: false },
      },
    });

    // Subscribe to INSERT / UPDATE on media_processing_jobs for this design
    channel.on(
      'postgres_changes',
      {
        event:  '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table:  'media_processing_jobs',
        filter: `design_id=eq.${designId}`,
      },
      (_payload) => {
        // Re-fetch full set on any change — simpler than trying to merge rows
        fetchStatus();
      }
    );

    // Also watch media_assets changes for the design (asset status: ready/failed)
    channel.on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'media_assets',
        filter: `design_id=eq.${designId}`,
      },
      (_payload) => {
        // Trigger a re-fetch so the status reflects the latest asset state
        fetchStatus();
      }
    );

    channel.subscribe((channelStatus) => {
      if (channelStatus === 'CHANNEL_ERROR') {
        setError('realtime_subscription_failed');
      }
    });

    channelRef.current = channel as any;

    return () => {
      db.removeChannel(channel);
    };
  }, [designId, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

// =============================================================================
// Helper: build DesignProcessingStatus from raw jobs array
// =============================================================================

function buildDesignStatus(
  designId: string,
  jobs: MediaProcessingJob[]
): DesignProcessingStatus {
  const latest = (type: ProcessingJobType): MediaProcessingJob | null =>
    jobs.find((j) => j.job_type === type) ?? null;

  const metadataJob  = latest('metadata');
  const previewJob   = latest('preview');
  const thumbnailJob = latest('thumbnail');

  const overallStatus = computeOverallStatus(metadataJob, previewJob, thumbnailJob);
  const allComplete   =
    metadataJob?.status  === 'completed' &&
    previewJob?.status   === 'completed' &&
    thumbnailJob?.status === 'completed';

  return {
    design_id:     designId,
    overallStatus,
    allComplete,
    jobs: {
      metadata:  metadataJob,
      preview:   previewJob,
      thumbnail: thumbnailJob,
    },
  };
}

function computeOverallStatus(
  ...jobs: Array<MediaProcessingJob | null>
): ProcessingJobStatus | 'idle' {
  const statuses = jobs.filter(Boolean).map((j) => j!.status);

  if (statuses.length === 0)               return 'idle';
  if (statuses.includes('failed'))         return 'failed';
  if (statuses.includes('processing'))     return 'processing';
  if (statuses.includes('queued'))         return 'queued';
  if (statuses.every((s) => s === 'completed')) return 'completed';

  return 'queued';
}
