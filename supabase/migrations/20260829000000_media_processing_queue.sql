/*
# Phase 9: Media Processing Queue

## Overview
Introduces an asynchronous job queue for background media processing.
ALL changes are ADDITIVE — no existing columns, tables, RLS policies,
storage buckets, or constraints are modified or removed.

## What This Migration Does

### New Table: media_processing_jobs
  Tracks individual processing jobs (metadata extraction, preview
  generation, thumbnail generation) dispatched after file upload.
  Each job has its own lifecycle: queued → processing → completed | failed.

### Fields
  - id                UUID PK
  - media_asset_id    FK → media_assets(id) CASCADE DELETE
  - design_id         FK → designs(id) CASCADE DELETE
  - creator_id        FK → creators(id) CASCADE DELETE
  - job_type          text  CHECK ('metadata' | 'preview' | 'thumbnail')
  - status            text  CHECK ('queued' | 'processing' | 'completed' | 'failed')
  - attempt_count     integer DEFAULT 0
  - error_message     text nullable
  - started_at        timestamptz nullable
  - completed_at      timestamptz nullable
  - created_at        timestamptz NOT NULL DEFAULT now()
  - updated_at        timestamptz NOT NULL DEFAULT now()

### RLS
  - Creators can SELECT only their own jobs (via creator_id ownership chain)
  - No INSERT / UPDATE / DELETE allowed from client sessions
  - Worker runs via service role — bypasses RLS (intentional)
  - No anonymous access at all

### Performance indexes
  - idx_mpj_status        — queue drain query: WHERE status = 'queued'
  - idx_mpj_creator       — creator dashboard: WHERE creator_id = ?
  - idx_mpj_media_asset   — per-asset status lookup
  - idx_mpj_design        — per-design status lookup

## Tables NOT Changed
  - designs, creators, media_assets, shops, categories, tags,
    collections, reviews, favorites, user_profiles, all storage tables

## Compatibility
  - Phase 1–8 migrations: unaffected
  - All existing RLS policies: untouched
  - All existing storage buckets: untouched
  - All existing service functions: continue to work

## Rollback SQL
```sql
DROP TABLE IF EXISTS public.media_processing_jobs;
```
*/

-- =============================================================================
-- STEP 1: Create media_processing_jobs table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.media_processing_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership chain — all three cascade so orphan jobs are auto-cleaned
  media_asset_id   uuid        NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  design_id        uuid        NOT NULL REFERENCES public.designs(id)      ON DELETE CASCADE,
  creator_id       uuid        NOT NULL REFERENCES public.creators(id)     ON DELETE CASCADE,

  -- What processing step this job performs
  job_type         text        NOT NULL
                               CHECK (job_type IN ('metadata', 'preview', 'thumbnail')),

  -- Lifecycle status of the job
  status           text        NOT NULL DEFAULT 'queued'
                               CHECK (status IN ('queued', 'processing', 'completed', 'failed')),

  -- Retry tracking — worker increments on each attempt
  attempt_count    integer     NOT NULL DEFAULT 0,

  -- Failure reason (last error message from worker)
  error_message    text,

  -- Timing — populated by the worker
  started_at       timestamptz,
  completed_at     timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.media_processing_jobs IS
  'Phase 9: Background job queue for async media processing (metadata, preview, thumbnail). '
  'Workers claim jobs by setting status=processing; never expose to clients via INSERT/UPDATE/DELETE.';

COMMENT ON COLUMN public.media_processing_jobs.attempt_count IS
  'Incremented by the worker on each processing attempt. Used for retry back-off logic.';

COMMENT ON COLUMN public.media_processing_jobs.error_message IS
  'Last error message from the worker. Overwritten on each failed attempt.';


-- =============================================================================
-- STEP 2: Auto-update updated_at on every row change
-- =============================================================================

-- Reuse the shared trigger function from Phase 2
DROP TRIGGER IF EXISTS trigger_media_processing_jobs_updated_at ON public.media_processing_jobs;
CREATE TRIGGER trigger_media_processing_jobs_updated_at
  BEFORE UPDATE ON public.media_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- STEP 3: Performance indexes
-- =============================================================================

-- Queue drain: worker fetches all queued jobs in FIFO order
CREATE INDEX IF NOT EXISTS idx_mpj_status
  ON public.media_processing_jobs (status, created_at)
  WHERE status IN ('queued', 'processing');

-- Creator-scoped lookup: dashboard shows only own jobs
CREATE INDEX IF NOT EXISTS idx_mpj_creator
  ON public.media_processing_jobs (creator_id, created_at DESC);

-- Per-asset lookup: check job state for a specific media asset
CREATE INDEX IF NOT EXISTS idx_mpj_media_asset
  ON public.media_processing_jobs (media_asset_id);

-- Per-design lookup: get all jobs for a design (realtime subscription)
CREATE INDEX IF NOT EXISTS idx_mpj_design
  ON public.media_processing_jobs (design_id, status);

-- Failed jobs requiring admin attention
CREATE INDEX IF NOT EXISTS idx_mpj_failed
  ON public.media_processing_jobs (creator_id, status)
  WHERE status = 'failed';


-- =============================================================================
-- STEP 4: Enable RLS on media_processing_jobs
-- =============================================================================

ALTER TABLE public.media_processing_jobs ENABLE ROW LEVEL SECURITY;

-- CREATOR READ: creators may SELECT only their own job records.
-- They see the status, attempt_count, and error_message — nothing more.
-- This enables the realtime subscription in the creator dashboard.
DROP POLICY IF EXISTS "creator_read_own_jobs" ON public.media_processing_jobs;
CREATE POLICY "creator_read_own_jobs" ON public.media_processing_jobs
  FOR SELECT
  TO authenticated
  USING (public.auth_user_owns_creator(creator_id));

-- NO CLIENT MUTATIONS: no INSERT/UPDATE/DELETE policies for authenticated role.
-- All job creation and status updates are performed by the worker via
-- the Supabase service role key (which bypasses RLS entirely).
-- This prevents creators from manipulating job status directly.

-- NO ANONYMOUS ACCESS: absence of anon policies → deny by default.


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'media_processing_jobs'
--    ORDER BY ordinal_position;
--    → Should show all 14 columns above
--
-- 2. SELECT tablename, policyname FROM pg_policies
--    WHERE tablename = 'media_processing_jobs';
--    → Should show: creator_read_own_jobs (SELECT only)
--
-- 3. SELECT count(*) FROM public.media_processing_jobs;
--    → Should return 0 (table is empty on creation)
--
-- 4. SELECT count(*) FROM public.media_assets;
--    → Should return 0 (Phase 5 table, unmodified)
--
-- 5. SELECT count(*) FROM public.designs;
--    → Should still return 40 (seed data untouched)
