/**
 * Media Processing Queue types — Phase 9.
 *
 * Defines the MediaProcessingJob entity and all related input/output
 * shapes for the asynchronous background processing pipeline.
 *
 * These types mirror the `media_processing_jobs` table schema introduced
 * in the Phase 9 migration (20260829000000_media_processing_queue.sql).
 *
 * Security note: the job row is READ-ONLY for authenticated client sessions.
 * All job creation and status updates are performed by the background worker
 * via the service role. Creators can only SELECT their own jobs.
 */

// =============================================================================
// Enumerations
// =============================================================================

/**
 * The type of processing work this job performs.
 *
 * metadata   — Extract image dimensions, file size, and SHA-256 checksum.
 * preview    — Generate a 1200px-wide preview image for the detail page.
 * thumbnail  — Generate a 400px-wide thumbnail for marketplace grid cards.
 */
export type ProcessingJobType = 'metadata' | 'preview' | 'thumbnail';

/**
 * Lifecycle status of a processing job.
 *
 * queued     — Job created and waiting to be picked up by the worker.
 * processing — Worker has locked the job and is actively processing it.
 * completed  — Worker finished successfully; media_assets updated to 'ready'.
 * failed     — Worker failed all MAX_ATTEMPTS attempts; error_message is set.
 */
export type ProcessingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

// =============================================================================
// Core entity
// =============================================================================

/**
 * Full media_processing_jobs row as stored in the database.
 *
 * NOTE: Creators can SELECT this row but cannot INSERT/UPDATE/DELETE it.
 * The worker uses the service role key to manage all state transitions.
 */
export type MediaProcessingJob = {
  /** Standalone UUID PK */
  id: string;
  /** FK → media_assets.id — which asset this job processes */
  media_asset_id: string;
  /** FK → designs.id — for RLS scoping and realtime subscriptions */
  design_id: string;
  /** FK → creators.id — for ownership verification */
  creator_id: string;
  /** What processing step this job performs */
  job_type: ProcessingJobType;
  /** Current lifecycle status */
  status: ProcessingJobStatus;
  /** Number of processing attempts made (starts at 0, max 3) */
  attempt_count: number;
  /** Last error message from a failed attempt (null if never failed) */
  error_message: string | null;
  /** When the worker last started processing this job */
  started_at: string | null;
  /** When the worker completed this job successfully */
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// Service input / output types
// =============================================================================

/**
 * Input for creating a new processing job.
 * Used internally by queueMediaProcessing() — never accepted from client.
 */
export type CreateProcessingJobInput = {
  media_asset_id: string;
  design_id: string;
  creator_id: string;
  job_type: ProcessingJobType;
};

/**
 * Status summary for all processing jobs associated with a design.
 * Used by the creator dashboard realtime subscription and status hooks.
 */
export type DesignProcessingStatus = {
  design_id: string;
  /** Rolled-up human-readable status for display in the UI */
  overallStatus: ProcessingJobStatus | 'idle';
  /**
   * Whether ALL three job types have been created and completed.
   * When true, the design's media assets are fully ready.
   */
  allComplete: boolean;
  jobs: {
    metadata:  MediaProcessingJob | null;
    preview:   MediaProcessingJob | null;
    thumbnail: MediaProcessingJob | null;
  };
};

/**
 * Result of queueMediaProcessing().
 * The created job IDs are returned so the upload handler can log them.
 */
export type QueueProcessingResult =
  | {
      success: true;
      jobIds: {
        metadata:  string;
        preview:   string;
        thumbnail: string;
      };
    }
  | {
      success: false;
      reason: string;
    };

/**
 * Result of getProcessingStatus().
 */
export type GetProcessingStatusResult =
  | {
      found: true;
      status: DesignProcessingStatus;
    }
  | {
      found: false;
      reason: string;
    };

/**
 * Result of retryFailedProcessing().
 */
export type RetryProcessingResult =
  | {
      success: true;
      /** Number of jobs that were re-queued */
      retried: number;
    }
  | {
      success: false;
      reason: string;
    };

/**
 * Result of cancelProcessingJob().
 */
export type CancelJobResult =
  | { success: true }
  | { success: false; reason: string };
