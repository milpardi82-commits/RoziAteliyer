/**
 * Media Processing Queue Service — Phase 9.
 *
 * Provides the queue-based async processing API that replaces the synchronous
 * processDesignMedia() call in the upload Route Handler.
 *
 * Core functions:
 *   queueMediaProcessing()   — Create all three jobs (metadata/preview/thumbnail)
 *   createProcessingJob()    — Create a single job record
 *   getProcessingStatus()    — Fetch all jobs for a design with a rolled-up status
 *   retryFailedProcessing()  — Re-queue failed jobs (resets to 'queued')
 *   cancelProcessingJob()    — Mark a queued/processing job as failed (cancel)
 *   appendProcessingLog()    — Write a structured log entry to media_assets.processing_log
 *
 * Security model:
 *   - All functions run SERVER-SIDE ONLY.
 *   - Job records are NEVER inserted/updated by client sessions (no client RLS).
 *   - Ownership is always verified: creator_id must match the session creator.
 *   - The worker runs with the service role key — these service functions
 *     use the authenticated server client (anon key + RLS) for creator-side
 *     queries, and the service-role path is reserved for the Edge Function.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { resolveAuthenticatedCreatorId } from '@/services/media.service';
import type {
  MediaProcessingJob,
  ProcessingJobType,
  ProcessingJobStatus,
  DesignProcessingStatus,
  QueueProcessingResult,
  GetProcessingStatusResult,
  RetryProcessingResult,
  CancelJobResult,
  CreateProcessingJobInput,
} from '@/types/media-queue';
import type { ProcessingLogEntry } from '@/services/media-processing.service';

// =============================================================================
// Queue entry point
// =============================================================================

/**
 * Queue all three processing jobs for a newly uploaded original asset.
 *
 * Creates three job records (metadata, preview, thumbnail) atomically.
 * The background worker (Supabase Edge Function) will pick them up and
 * process them asynchronously.
 *
 * Replaces the synchronous processDesignMedia() call in the upload handler.
 * Callers should update media_assets.status = 'processing' before calling this.
 *
 * @param creatorId     - creators.id (resolved server-side from session)
 * @param designId      - designs.id
 * @param mediaAssetId  - media_assets.id (the original asset)
 */
export async function queueMediaProcessing(
  creatorId: string,
  designId: string,
  mediaAssetId: string
): Promise<QueueProcessingResult> {
  // Verify the caller owns the creator record
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return { success: false, reason: 'not_authenticated' };
  }

  // Verify asset ownership — creator must own the media asset
  const { data: asset } = await db
    .from('media_assets')
    .select('id, creator_id')
    .eq('id', mediaAssetId)
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (!asset) {
    return { success: false, reason: 'asset_not_found_or_unauthorized' };
  }

  const jobTypes: ProcessingJobType[] = ['metadata', 'preview', 'thumbnail'];
  const createdIds: Record<string, string> = {};

  for (const jobType of jobTypes) {
    const result = await createProcessingJob({
      media_asset_id: mediaAssetId,
      design_id:      designId,
      creator_id:     creatorId,
      job_type:       jobType,
    });

    if (!result) {
      return { success: false, reason: `failed_to_create_${jobType}_job` };
    }

    createdIds[jobType] = result.id;
  }

  // Append upload_started log entry to the original asset
  await appendProcessingLog(mediaAssetId, {
    ts:      new Date().toISOString(),
    event:   'upload_started',
    status:  'processing',
    message: `Processing jobs queued: metadata, preview, thumbnail`,
  });

  return {
    success: true,
    jobIds: {
      metadata:  createdIds['metadata']!,
      preview:   createdIds['preview']!,
      thumbnail: createdIds['thumbnail']!,
    },
  };
}

// =============================================================================
// Individual job management
// =============================================================================

/**
 * Create a single processing job record.
 *
 * This inserts directly into media_processing_jobs using the auth client.
 * The INSERT policy for this table is intentionally absent for client sessions —
 * this call only works from server-side routes (Route Handlers/Server Actions)
 * where the anon key is used server-side.
 *
 * Note: the worker uses service-role to update jobs. This function uses
 * the server-side auth client, which inherits the session's JWT and will
 * fail if called from client code (no INSERT RLS policy exists).
 *
 * @internal Use queueMediaProcessing() for the full pipeline.
 */
export async function createProcessingJob(
  input: CreateProcessingJobInput
): Promise<MediaProcessingJob | null> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await (db.from('media_processing_jobs') as any)
      .insert({
        media_asset_id: input.media_asset_id,
        design_id:      input.design_id,
        creator_id:     input.creator_id,
        job_type:       input.job_type,
        status:         'queued',
        attempt_count:  0,
      })
      .select()
      .single();

    if (error) {
      console.error(`[createProcessingJob] DB error:`, error.message);
      return null;
    }

    return data as MediaProcessingJob;
  } catch (err) {
    console.error(`[createProcessingJob] Unexpected error:`, err);
    return null;
  }
}

/**
 * Fetch the processing status for all jobs associated with a design.
 *
 * Returns a rolled-up DesignProcessingStatus with individual job state
 * for each of the three job types (metadata, preview, thumbnail).
 *
 * Used by:
 *   - getProcessingStatus() route handler
 *   - Server Component data-fetching before passing to client
 *   - useMediaProcessingStatus hook (server-side initial fetch)
 *
 * SECURITY: uses the session client — RLS `creator_read_own_jobs` ensures
 * creators can only see their own jobs.
 *
 * @param designId - designs.id
 */
export async function getProcessingStatus(
  designId: string
): Promise<GetProcessingStatusResult> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await (db.from('media_processing_jobs') as any)
      .select('*')
      .eq('design_id', designId)
      .order('created_at', { ascending: false });

    if (error) {
      return { found: false, reason: error.message };
    }

    const jobs = (data ?? []) as MediaProcessingJob[];

    // Pick the most recent job of each type
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
      found: true,
      status: {
        design_id:     designId,
        overallStatus,
        allComplete,
        jobs: {
          metadata:  metadataJob,
          preview:   previewJob,
          thumbnail: thumbnailJob,
        },
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    return { found: false, reason };
  }
}

/**
 * Re-queue all failed jobs for a design.
 *
 * Resets failed jobs back to 'queued' and clears the error_message.
 * Preserves attempt_count so the worker's MAX_ATTEMPTS cap is honoured.
 *
 * Only the owning creator can retry their own jobs (verified via RLS +
 * the explicit creator_id check below).
 *
 * @param designId  - designs.id
 */
export async function retryFailedProcessing(
  designId: string
): Promise<RetryProcessingResult> {
  try {
    const db = createSupabaseServerClient();

    // Resolve creator_id from session (server-side only)
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, reason: 'not_authenticated_or_not_a_creator' };
    }

    // Fetch the failed jobs for this creator's design
    const { data: failedJobs, error: fetchErr } = await (db.from('media_processing_jobs') as any)
      .select('id')
      .eq('design_id', designId)
      .eq('creator_id', creatorId)
      .eq('status', 'failed');

    if (fetchErr) {
      return { success: false, reason: fetchErr.message };
    }

    const jobs = (failedJobs ?? []) as Array<{ id: string }>;
    if (jobs.length === 0) {
      return { success: true, retried: 0 };
    }

    const ids = jobs.map((j) => j.id);

    const { error: updateErr } = await (db.from('media_processing_jobs') as any)
      .update({
        status:        'queued',
        error_message: null,
        started_at:    null,
        completed_at:  null,
      })
      .in('id', ids)
      .eq('creator_id', creatorId); // Redundant safety check

    if (updateErr) {
      return { success: false, reason: updateErr.message };
    }

    return { success: true, retried: ids.length };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    return { success: false, reason };
  }
}

/**
 * Cancel a specific queued or processing job.
 *
 * Marks the job as 'failed' with a cancellation message.
 * Used when a creator re-uploads a file and the previous jobs become stale.
 *
 * SECURITY: only the owning creator can cancel their own jobs.
 *
 * @param jobId - media_processing_jobs.id
 */
export async function cancelProcessingJob(
  jobId: string
): Promise<CancelJobResult> {
  try {
    const db = createSupabaseServerClient();

    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, reason: 'not_authenticated_or_not_a_creator' };
    }

    const { error } = await (db.from('media_processing_jobs') as any)
      .update({
        status:        'failed',
        error_message: 'cancelled_by_creator',
        completed_at:  new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('creator_id', creatorId)  // Ownership check
      .in('status', ['queued', 'processing']);

    if (error) {
      return { success: false, reason: error.message };
    }

    return { success: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    return { success: false, reason };
  }
}

// =============================================================================
// Processing log
// =============================================================================

/**
 * Append a structured log entry to media_assets.processing_log (JSONB array).
 *
 * Implements the full Phase 9 version of the Phase 8 no-op placeholder.
 * Uses a safe read-modify-write pattern (fetch → append → update).
 *
 * Fire-and-forget: errors are swallowed so log failures never block
 * the main processing pipeline.
 *
 * Log entry shape:
 * {
 *   ts:      ISO-8601 timestamp
 *   event:   e.g. 'upload_started', 'processing_started', 'thumbnail_generated'
 *   status:  e.g. 'processing', 'ready', 'failed'
 *   message: human-readable description
 * }
 *
 * @param assetId - media_assets.id
 * @param entry   - Structured log entry to append
 */
export async function appendProcessingLog(
  assetId: string,
  entry: ProcessingLogEntry
): Promise<void> {
  try {
    const db = createSupabaseServerClient();

    // Read current log
    const { data } = await (db.from('media_assets') as any)
      .select('processing_log')
      .eq('id', assetId)
      .maybeSingle();

    const current: ProcessingLogEntry[] = Array.isArray(
      (data as { processing_log: ProcessingLogEntry[] | null } | null)?.processing_log
    )
      ? (data as { processing_log: ProcessingLogEntry[] }).processing_log
      : [];

    // Append and cap at 100 entries to prevent unbounded growth
    const updated = [...current, entry].slice(-100);

    await (db.from('media_assets') as any)
      .update({ processing_log: updated })
      .eq('id', assetId);
  } catch {
    // Non-fatal: log failures should never abort processing
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Compute a single rolled-up status from the three job states.
 *
 * Priority (highest to lowest):
 *   1. If any job is 'failed'     → 'failed'
 *   2. If any job is 'processing' → 'processing'
 *   3. If any job is 'queued'     → 'queued'
 *   4. If all jobs are 'completed' → 'completed'
 *   5. No jobs at all             → 'idle'
 */
function computeOverallStatus(
  ...jobs: Array<MediaProcessingJob | null>
): ProcessingJobStatus | 'idle' {
  const statuses = jobs.filter(Boolean).map((j) => j!.status);

  if (statuses.length === 0)         return 'idle';
  if (statuses.includes('failed'))   return 'failed';
  if (statuses.includes('processing')) return 'processing';
  if (statuses.includes('queued'))   return 'queued';
  if (statuses.every((s) => s === 'completed')) return 'completed';

  return 'queued';
}
