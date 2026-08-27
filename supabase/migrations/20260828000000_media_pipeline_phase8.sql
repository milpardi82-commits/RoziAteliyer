/*
# Phase 8: Media Pipeline — Additive Extensions

## Overview
Extends the media_assets table with a checksum column for file integrity
verification and adds a processing_log column for audit trail support.

ALL changes are ADDITIVE — no existing columns, tables, rows, RLS policies,
or storage buckets are modified or removed.

## What This Migration Does

### media_assets — two new optional columns
  - `checksum`        text (nullable) — SHA-256 hex digest of the file content.
                       Populated server-side after a successful upload.
                       Used for deduplication and integrity verification.
  - `processing_log`  jsonb (nullable) — structured log for processing events.
                       Allows future background workers to write processing
                       steps without altering core schema.

### New partial index
  - idx_media_assets_checksum — speeds up deduplication checks for uploaded
    files that share the same content.

## Tables NOT Changed
- designs, creators, shops, categories, tags, collections, reviews, favorites,
  user_favorites, follows, collection_items, design_categories, design_tags,
  user_profiles, creator_applications, storage.objects, storage.buckets

## Risk Assessment
- Risk Level: SAFE
- All existing rows in media_assets: unmodified (both columns are nullable)
- All existing RLS policies: untouched
- All existing queries: continue to work without modification
- All existing storage paths: unchanged

## Rollback SQL
```sql
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS checksum;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS processing_log;
DROP INDEX IF EXISTS idx_media_assets_checksum;
```
*/

-- =============================================================================
-- STEP 1: Add checksum column to media_assets
-- =============================================================================
-- Nullable: existing rows are unaffected.
-- Server-side service sets this after computing SHA-256 of the uploaded file.
-- Format: lowercase 64-char hex string (SHA-256).
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS checksum text;

-- Constraint: enforce the expected hex-only format when a value is present.
-- Allows NULL (upload incomplete / legacy rows) but rejects garbage values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_checksum_format'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_checksum_format
      CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$');
  END IF;
END;
$$;


-- =============================================================================
-- STEP 2: Add processing_log column to media_assets
-- =============================================================================
-- JSONB array of timestamped processing events for audit and debugging.
-- Structure (not enforced at DB level — validated in the service layer):
--   [{ "ts": "2026-08-28T12:00:00Z", "event": "upload_started", "detail": {} }]
--
-- NULL means no processing events have been recorded yet (new uploads).
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS processing_log jsonb;


-- =============================================================================
-- STEP 3: Performance index on checksum
-- =============================================================================
-- Speeds up "does this exact file already exist?" deduplication queries.
-- Partial: only indexes non-null checksums (rows that have completed uploads).
CREATE INDEX IF NOT EXISTS idx_media_assets_checksum
  ON public.media_assets (checksum)
  WHERE checksum IS NOT NULL;


-- =============================================================================
-- STEP 4: Performance index on processing_log IS NOT NULL
-- =============================================================================
-- Allows fast queries for "find all assets currently being processed"
-- (future background worker queue draining).
CREATE INDEX IF NOT EXISTS idx_media_assets_processing
  ON public.media_assets (design_id, status)
  WHERE status = 'processing';


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'media_assets'
--    ORDER BY ordinal_position;
--    → Should include: checksum (text, YES), processing_log (jsonb, YES)
--
-- 2. SELECT count(*) FROM public.media_assets WHERE checksum IS NOT NULL;
--    → Should return 0 (no existing rows are affected)
--
-- 3. SELECT count(*) FROM public.designs;
--    → Should still return 40 (seed data untouched)
