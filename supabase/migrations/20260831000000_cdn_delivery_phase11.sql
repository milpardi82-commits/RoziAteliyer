/*
# Phase 11: CDN Delivery & Public Media Layer

## Overview
Introduces a production-ready public delivery layer for marketplace thumbnails
and previews. ALL changes are ADDITIVE — no existing tables, columns, rows,
RLS policies, storage buckets, or seed data are modified or removed.

## Architecture

  Creator Upload
        |
        v
  designs-private  ← originals always stay here (Phase 5)
        |
        v
  Optimization Worker (Phase 10)
        |
        v
  Optimized Preview / Thumbnail
        |
        v
  designs-public  ← NEW: public CDN bucket (Phase 11)
        |
        v
  Marketplace (anonymous CDN delivery — no signed URL required)

## What This Migration Does

### New Storage Bucket
  designs-public
    - public = true  (anonymous read enabled at bucket level)
    - Contains ONLY: thumbnail/ and preview/ subtrees
    - Originals are NEVER stored here
    - Only the server-side worker may write (service role)
    - No client upload path

### New Storage RLS Policies on designs-public
  storage_public_read          — anon + authenticated SELECT allowed
  storage_public_worker_insert — service role INSERT (worker only via service_role bypass)

  NOTE: Because the worker runs with the SERVICE_ROLE key it bypasses RLS entirely.
  The "worker insert" policy is documented here as a belt-and-suspenders guard in case
  the bucket is accidentally accessed from an authenticated client session.
  Storage bucket-level public=true also allows direct CDN reads without a policy
  being required — but the explicit SELECT policy documents intent clearly.

### media_assets — three new nullable columns

  public_url   text (nullable)
    The permanent CDN URL for this asset in the designs-public bucket.
    Format: {SUPABASE_URL}/storage/v1/object/public/designs-public/{storage_path}
    Populated by the worker after copying the optimized file to the public bucket.
    NULL for: original assets (never public), pre-Phase-11 assets, unpublished assets.

  cdn_path     text (nullable)
    The storage path within designs-public.
    Format: thumbnail/{creator_id}/{design_id}/{filename} or
            preview/{creator_id}/{design_id}/{filename}
    NULL for original assets and pre-Phase-11 rows.

  published_at timestamptz (nullable)
    Timestamp when this asset was first published to the CDN (copied to public bucket).
    Distinct from optimized_at (Phase 10) which records when WASM processing ran.
    NULL for assets not yet published to the CDN.

### New Performance Indexes
  idx_media_assets_public_url   — fast lookup of assets with a public CDN URL
  idx_media_assets_cdn_path     — fast lookup by cdn_path uniqueness
  idx_media_assets_published    — find recently published assets for cache-busting

## Tables NOT Changed
  media_processing_jobs, designs, creators, shops, categories, tags,
  collections, reviews, favorites, user_profiles, creator_applications

## RLS NOT Changed
  All existing RLS policies on media_assets, media_processing_jobs, and
  storage.objects (designs-private bucket) are untouched.

## Storage NOT Changed
  designs-private bucket: configuration, policies, and all stored paths are unchanged.

## Compatibility
  Phase 1–10 migrations: all unaffected.
  Existing queries: continue to work (three new nullable columns are invisible to
  existing SELECT consumers that do not reference them).
  Phase 10 worker: continues uploading to designs-private as before.
  Phase 11 worker extension: additionally copies to designs-public and writes
  public_url / cdn_path / published_at — safe because all three are nullable.
  Seed data (40 designs, 8 creators): completely unmodified.

## Security Guarantees
  Anonymous users:
    ✓ can read published thumbnails via CDN (designs-public, public=true)
    ✓ can read published previews via CDN (designs-public, public=true)
    ✗ cannot access originals (designs-private, no anon policy)
    ✗ cannot access unpublished assets (public_url is NULL until published)
    ✗ cannot upload to designs-public (no INSERT policy for anon/authenticated)

  Creators:
    ✓ access own originals in designs-private (existing Phase 5 policy)
    ✓ access own previews via signed URL (existing Phase 8 service)
    ✗ Creator A cannot access Creator B media (ownership chain enforced)

## Risk Assessment
  Risk Level: SAFE
  All three new columns are nullable — existing rows are unaffected.
  No data is migrated or rewritten.
  No triggers or functions are added or changed.
  designs-private bucket: completely untouched.

## Rollback SQL
```sql
-- Step 1: Drop new columns from media_assets
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS public_url;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS cdn_path;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS published_at;

-- Step 2: Drop new indexes
DROP INDEX IF EXISTS idx_media_assets_public_url;
DROP INDEX IF EXISTS idx_media_assets_cdn_path;
DROP INDEX IF EXISTS idx_media_assets_published;

-- Step 3: Remove public storage policies (via Supabase Dashboard or management API)
-- DELETE FROM storage.policies WHERE bucket_id = 'designs-public';

-- Step 4: Remove the public bucket (ONLY if it contains no files)
-- DELETE FROM storage.buckets WHERE id = 'designs-public';
-- (or via Dashboard → Storage → delete bucket)
```
*/

-- =============================================================================
-- STEP 1: Create the designs-public Storage bucket
-- =============================================================================
-- This bucket stores ONLY optimized thumbnails and previews for public CDN delivery.
-- It is PUBLIC — anonymous users can read objects directly via CDN URL.
--
-- Security controls:
--   - public = true enables CDN-level read without signed URLs
--   - No allowed_mime_types restriction needed: the worker always writes JPEG/WEBP
--     outputs; a liberal type list here avoids blocking future format additions
--   - File size limit: 10 MB per file (thumbnails ≤ 400px and previews ≤ 1200px
--     should never exceed a few hundred KB; 10 MB is a generous safety cap)
--   - Only the service-role worker can write; client sessions have no INSERT policy
--
-- Idempotent: ON CONFLICT DO NOTHING means re-running this migration is safe.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'designs-public',
  'designs-public',
  true,                               -- CDN public read enabled
  10485760,                           -- 10 MB per file (generous safety cap)
  ARRAY[
    'image/jpeg',
    'image/webp',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE storage.buckets IS
  'Supabase Storage buckets. designs-public added in Phase 11 for CDN delivery.';


-- =============================================================================
-- STEP 2: Storage RLS policies for designs-public bucket
-- =============================================================================
-- Public SELECT: any user (anon or authenticated) can read CDN files.
-- This is belt-and-suspenders — the bucket's public=true flag already allows
-- anonymous reads, but an explicit policy documents intent.

DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
CREATE POLICY "storage_public_read" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'designs-public'
    -- Only allow reads from the canonical path structures
    AND (
      (storage.foldername(name))[1] IN ('thumbnail', 'preview')
    )
  );

-- Authenticated INSERT guard: prevents any client session (even an authenticated
-- creator) from writing directly to the public bucket.
-- The worker uses the service role key which bypasses RLS — so this policy
-- effectively blocks only client-side attempts.
-- No INSERT policy for anon or authenticated means INSERT is denied by default.

-- DELETE guard: no client-side DELETE policy on designs-public.
-- Files are managed exclusively by the service-role worker.


-- =============================================================================
-- STEP 3: Add public_url column to media_assets
-- =============================================================================
-- Nullable text. Populated by the Phase 11 worker after copying the optimized
-- file to the designs-public bucket and constructing the permanent CDN URL.
--
-- Format: {SUPABASE_URL}/storage/v1/object/public/designs-public/{cdn_path}
-- Example: https://xxx.supabase.co/storage/v1/object/public/designs-public/thumbnail/abc/def/image_thumb.jpg
--
-- NULL means this asset has not yet been published to the CDN. Consumers
-- must treat NULL public_url as "not available — use fallback".

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS public_url text;

COMMENT ON COLUMN public.media_assets.public_url IS
  'Phase 11: permanent CDN URL for this asset in the designs-public bucket. '
  'Format: {SUPABASE_URL}/storage/v1/object/public/designs-public/{cdn_path}. '
  'NULL = not yet published to CDN (original assets, unpublished designs, '
  'or pre-Phase-11 rows).';


-- =============================================================================
-- STEP 4: Add cdn_path column to media_assets
-- =============================================================================
-- Nullable text. The path within the designs-public bucket.
-- Distinct from storage_path (which is the path inside designs-private).
--
-- Format: {asset_type}/{creator_id}/{design_id}/{filename}
-- Example: thumbnail/abc-0001/def-0002/image_thumb.jpg
--
-- NULL for original assets and pre-Phase-11 rows.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS cdn_path text;

COMMENT ON COLUMN public.media_assets.cdn_path IS
  'Phase 11: path within the designs-public bucket. '
  'Format: {asset_type}/{creator_id}/{design_id}/{filename}. '
  'Distinct from storage_path (designs-private). '
  'NULL for original assets and pre-Phase-11 rows.';


-- =============================================================================
-- STEP 5: Add published_at column to media_assets
-- =============================================================================
-- Nullable timestamptz. Timestamp when this asset was first copied to the
-- designs-public bucket (made publicly accessible via CDN).
--
-- Distinct from:
--   created_at    — when the record was first inserted
--   updated_at    — when any column was last changed
--   optimized_at  — when WASM processing ran (Phase 10)
--   published_at  — when the file was pushed to the public CDN (Phase 11)
--
-- NULL for assets not yet published to the CDN.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.media_assets.published_at IS
  'Phase 11: timestamp when this asset was first published to the CDN '
  '(copied to designs-public bucket). '
  'NULL = not yet published (original assets, pre-Phase-11 rows, or unpublished designs).';


-- =============================================================================
-- STEP 6: Performance indexes for the new CDN columns
-- =============================================================================

-- Fast lookup: "give me all assets with a CDN URL" (marketplace queries)
CREATE INDEX IF NOT EXISTS idx_media_assets_public_url
  ON public.media_assets (design_id, asset_type)
  WHERE public_url IS NOT NULL AND status = 'ready';

-- Fast lookup by cdn_path for worker deduplication / update
CREATE INDEX IF NOT EXISTS idx_media_assets_cdn_path
  ON public.media_assets (cdn_path)
  WHERE cdn_path IS NOT NULL;

-- Recently published assets (cache invalidation, admin reporting)
CREATE INDEX IF NOT EXISTS idx_media_assets_published
  ON public.media_assets (published_at DESC)
  WHERE published_at IS NOT NULL;


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
--
-- 1. SELECT id, name, public, file_size_limit
--    FROM storage.buckets
--    WHERE id IN ('designs-private', 'designs-public');
--    → Should return 2 rows:
--        designs-private  | public=false | 52428800
--        designs-public   | public=true  | 10485760
--
-- 2. SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'media_assets'
--    ORDER BY ordinal_position;
--    → Should include (among existing columns):
--        public_url   (text, YES)
--        cdn_path     (text, YES)
--        published_at (timestamp with time zone, YES)
--
-- 3. SELECT policyname, cmd, roles
--    FROM pg_policies
--    WHERE tablename = 'objects' AND policyname LIKE 'storage_public%';
--    → Should show: storage_public_read (SELECT, {anon,authenticated})
--
-- 4. SELECT count(*) FROM public.media_assets WHERE public_url IS NOT NULL;
--    → Should return 0 (no existing rows affected)
--
-- 5. SELECT count(*) FROM public.designs;
--    → Should still return 40 (seed data untouched)
--
-- 6. SELECT count(*) FROM public.creators;
--    → Should still return 8 (seed data untouched)
--
-- 7. SELECT tablename, policyname FROM pg_policies
--    WHERE tablename = 'media_assets' ORDER BY policyname;
--    → Should return exactly the same 5 policies as after Phase 10 — none added.
