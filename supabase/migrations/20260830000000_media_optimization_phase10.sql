/*
# Phase 10: Production Image Optimization Layer — Additive Schema Extension

## Overview
Extends media_assets with two new NULLABLE columns to track image optimization
metadata produced by the Phase 10 processing pipeline.

ALL changes are ADDITIVE — no existing columns, tables, rows, RLS policies,
storage buckets, or constraints are modified or removed.

## What This Migration Does

### media_assets — two new optional columns

  compression_ratio  float8 (nullable)
    Ratio of the optimized output file size to the original input size.
    e.g. 0.42 means the output is 42% the size of the original (58% savings).
    Populated by the Edge Function worker after WASM image optimization.
    NULL for assets processed before Phase 10 or where optimization was skipped.

  optimized_at  timestamptz (nullable)
    Timestamp when the image optimization step completed for this asset.
    Distinct from updated_at (which records any column change) —
    optimized_at specifically marks when the WASM processing ran.
    NULL for pre-Phase-10 assets.

## Tables NOT Changed
  media_processing_jobs, designs, creators, shops, categories, tags,
  collections, reviews, favorites, user_profiles, creator_applications,
  storage.objects, storage.buckets

## RLS NOT Changed
  All existing RLS policies on media_assets, media_processing_jobs, and
  storage.objects are untouched.

## Storage NOT Changed
  designs-private bucket: configuration, policies, and paths are unchanged.

## Compatibility
  Phase 1–9 migrations: all unaffected.
  All existing queries: continue to work (NULL columns are invisible to
  existing SELECT * consumers that don't reference the new columns).
  Edge Function worker: old jobs with neither column set will simply
  write NULL after processing — safe.

## Risk Assessment
  Risk Level: SAFE
  Both columns are nullable — existing rows are unaffected.
  No data is migrated or rewritten.
  No triggers or functions are added or changed.
  No indexes are required (not used in WHERE clauses for existing queries).

## Rollback SQL
```sql
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS compression_ratio;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS optimized_at;
DROP INDEX IF EXISTS idx_media_assets_optimized;
```
*/

-- =============================================================================
-- STEP 1: Add compression_ratio column to media_assets
-- =============================================================================
-- Nullable float8 (double precision). Populated by the Phase 10 Edge Function
-- worker after the WASM image optimization step runs.
-- Expected range: 0.0–1.0 (ratio of output size / input size).
-- Values > 1.0 are possible if the original is already well-compressed (e.g.
-- a highly optimized WEBP uploaded as the original). No CHECK constraint is
-- applied because those values are informational and not harmful.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS compression_ratio float8;

COMMENT ON COLUMN public.media_assets.compression_ratio IS
  'Phase 10: ratio of optimized output file size to original input size. '
  'e.g. 0.42 = output is 42% the size of the original (58% reduction). '
  'NULL = asset was not processed by the Phase 10 optimization pipeline.';


-- =============================================================================
-- STEP 2: Add optimized_at column to media_assets
-- =============================================================================
-- Nullable timestamptz. Set by the worker at the end of the optimization step.
-- Allows the dashboard to show "last optimized" timestamps and the admin
-- to identify assets that still need re-processing after a worker update.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS optimized_at timestamptz;

COMMENT ON COLUMN public.media_assets.optimized_at IS
  'Phase 10: timestamp when WASM image optimization completed for this asset. '
  'NULL = not yet optimized (pre-Phase-10 asset or optimization pending).';


-- =============================================================================
-- STEP 3: Optional supporting index
-- =============================================================================
-- Speeds up "find all assets not yet optimized" admin queries.
-- Partial: only indexes rows where optimized_at IS NULL so it remains small.

CREATE INDEX IF NOT EXISTS idx_media_assets_optimized
  ON public.media_assets (design_id, asset_type)
  WHERE optimized_at IS NULL AND status = 'ready';


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'media_assets'
--    ORDER BY ordinal_position;
--    → Should now include:
--        compression_ratio  (double precision, YES)
--        optimized_at       (timestamp with time zone, YES)
--
-- 2. SELECT count(*) FROM public.media_assets
--    WHERE compression_ratio IS NOT NULL;
--    → Should return 0 (no existing rows are affected)
--
-- 3. SELECT count(*) FROM public.media_assets
--    WHERE optimized_at IS NOT NULL;
--    → Should return 0 (no existing rows are affected)
--
-- 4. SELECT count(*) FROM public.designs;
--    → Should still return 40 (seed data untouched)
--
-- 5. SELECT tablename, policyname FROM pg_policies
--    WHERE tablename = 'media_assets' ORDER BY policyname;
--    → Should return exactly the same policies as after Phase 9 — none added.
--
-- 6. SELECT count(*) FROM public.media_processing_jobs;
--    → Unchanged from Phase 9.
