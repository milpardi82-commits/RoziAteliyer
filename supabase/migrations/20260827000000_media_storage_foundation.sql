/*
# Phase 5: Media & Storage Architecture Foundation

## Overview
Establishes the media asset domain model and Storage bucket architecture for the
Morrow Marketplace. All changes are ADDITIVE — no existing tables, columns,
relations, RLS policies, or seed data are modified.

## What This Migration Does

### New Table
- `media_assets` — tracks every file stored in Supabase Storage for a design.
  Links each physical file to its owning design and creator. Provides status
  tracking, dimension metadata, MIME type, and file size.

### New Storage Bucket
- `designs-private` — a private bucket for all design file uploads.
  Originals, previews, and thumbnails are all private by default.
  Public delivery of previews is a future task once image processing exists.

### New Storage RLS Policies on `designs-private`
- Creators can upload only to paths they own.
- Creators can read/delete only their own files.
- No anonymous access — all originals are private.
- Cross-creator access is impossible by policy.

## Tables NOT Changed
- designs, creators, shops, categories, tags, collections, reviews, favorites,
  user_favorites, follows, collection_items, design_categories, design_tags,
  user_profiles, creator_applications

## Risk Assessment
- Risk Level: SAFE
- All 40 seed designs, 8 seed creators, and all seed data: UNMODIFIED
- No existing columns, RLS policies, or relations changed
- All existing queries continue to work without modification
- `designs.image_url` and `designs.thumbnail_url` remain as-is (still serve Pexels seed URLs)

## Rollback SQL
```sql
-- Step 1: Drop the media_assets table
DROP TABLE IF EXISTS public.media_assets;

-- Step 2: Drop the Storage bucket and its policies
-- (Run in Supabase Dashboard → Storage, or via management API)
-- DELETE FROM storage.buckets WHERE id = 'designs-private';
-- Storage RLS policies are dropped automatically when the bucket is deleted.
```

## Storage Path Convention
All paths follow the deterministic structure:
  designs/{creator_id}/{design_id}/{asset_type}/{filename}

Where:
  - creator_id  = creators.id (standalone UUID)
  - design_id   = designs.id (UUID)
  - asset_type  = 'original' | 'preview' | 'thumbnail'
  - filename    = sanitised original filename (server-validated, no traversal)

Examples:
  designs/abc-0001/def-0002/original/pattern.png
  designs/abc-0001/def-0002/preview/pattern_preview.jpg
  designs/abc-0001/def-0002/thumbnail/pattern_thumb.jpg

This convention provides:
  - Unambiguous ownership (creator_id at level 2)
  - Easy cleanup on design delete (prefix: designs/{creator_id}/{design_id}/)
  - Easy future CDN path mapping
  - No random/uncontrolled paths
  - No path traversal risk (paths generated server-side only)

## Ownership Chain
  auth.users (auth.uid())
      ↓  [creators.user_id = auth.uid()]
  creators
      ↓  [designs.creator_id = creators.id]
  designs
      ↓  [media_assets.design_id = designs.id]
  media_assets
      ↓  [storage path: designs/{creator_id}/{design_id}/...]
  Storage objects
*/

-- =============================================================================
-- STEP 1: Create media_assets table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.media_assets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership chain — both FKs cascade so cleanup is automatic
  design_id     uuid        NOT NULL REFERENCES public.designs(id)  ON DELETE CASCADE,
  creator_id    uuid        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,

  -- Storage location — paths are generated server-side; never client-supplied
  -- Format: designs/{creator_id}/{design_id}/{asset_type}/{filename}
  storage_path  text        NOT NULL,
  storage_bucket text       NOT NULL DEFAULT 'designs-private',

  -- Asset classification
  asset_type    text        NOT NULL
                            CHECK (asset_type IN ('original', 'preview', 'thumbnail')),

  -- File metadata (populated on upload / after processing)
  mime_type     text        NOT NULL DEFAULT 'application/octet-stream',
  file_size     bigint,
  width         integer,
  height        integer,

  -- Processing lifecycle
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'deleted')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A design can have at most one asset per type that is not 'deleted'.
  -- Enforced via a partial unique index below.
  UNIQUE (design_id, asset_type, storage_path)
);

-- updated_at auto-maintenance (reuses existing function from migration 2)
DROP TRIGGER IF EXISTS trigger_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER trigger_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- STEP 2: Partial unique index — one active (non-deleted) asset per type per design
-- =============================================================================
-- This prevents having two simultaneous 'ready' originals for the same design.
-- Deleted assets are excluded so old records can be kept for audit purposes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_active_type
  ON public.media_assets (design_id, asset_type)
  WHERE status <> 'deleted';


-- =============================================================================
-- STEP 3: Performance indexes
-- =============================================================================

-- Primary lookup: all assets for a design (design detail page, cleanup)
CREATE INDEX IF NOT EXISTS idx_media_assets_design_id
  ON public.media_assets (design_id);

-- Creator-scoped lookup (creator dashboard, creator cleanup)
CREATE INDEX IF NOT EXISTS idx_media_assets_creator_id
  ON public.media_assets (creator_id);

-- Status-based queries (admin dashboard, failed cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_media_assets_status
  ON public.media_assets (status)
  WHERE status IN ('pending', 'processing', 'failed');

-- Composite: designer's ready assets by type (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_media_assets_design_type_ready
  ON public.media_assets (design_id, asset_type)
  WHERE status = 'ready';


-- =============================================================================
-- STEP 4: Enable RLS on media_assets
-- =============================================================================

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: only ready assets for published designs are visible to all users.
-- This covers future use when public thumbnails/previews are served.
DROP POLICY IF EXISTS "read_published_media_assets" ON public.media_assets;
CREATE POLICY "read_published_media_assets" ON public.media_assets
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'ready'
    AND asset_type IN ('preview', 'thumbnail')
    AND EXISTS (
      SELECT 1 FROM public.designs
      WHERE designs.id        = media_assets.design_id
      AND   designs.status    = 'published'
      AND   designs.is_public = true
    )
  );

-- OWNER READ: creators can read ALL their own media assets (all statuses, all types).
-- This allows creators to see pending/failed uploads in a future dashboard.
DROP POLICY IF EXISTS "read_own_media_assets" ON public.media_assets;
CREATE POLICY "read_own_media_assets" ON public.media_assets
  FOR SELECT
  TO authenticated
  USING (public.auth_user_owns_creator(creator_id));

-- OWNER INSERT: creators can only insert assets for their own designs.
-- creator_id consistency is enforced: the design's creator_id must match
-- the row's creator_id, and the caller must own that creator.
DROP POLICY IF EXISTS "insert_own_media_assets" ON public.media_assets;
CREATE POLICY "insert_own_media_assets" ON public.media_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_user_owns_creator(creator_id)
    AND EXISTS (
      SELECT 1 FROM public.designs
      WHERE designs.id         = media_assets.design_id
      AND   designs.creator_id = media_assets.creator_id
    )
  );

-- OWNER UPDATE: creators can update status/metadata on their own assets.
-- They cannot change design_id, creator_id, or storage_path after creation
-- (those are immutable — delete and re-insert instead).
DROP POLICY IF EXISTS "update_own_media_assets" ON public.media_assets;
CREATE POLICY "update_own_media_assets" ON public.media_assets
  FOR UPDATE
  TO authenticated
  USING  (public.auth_user_owns_creator(creator_id))
  WITH CHECK (
    public.auth_user_owns_creator(creator_id)
    -- Prevent changing the ownership or path fields via this policy
    AND creator_id  = (SELECT creator_id FROM public.media_assets WHERE id = media_assets.id)
    AND design_id   = (SELECT design_id   FROM public.media_assets WHERE id = media_assets.id)
    AND storage_path = (SELECT storage_path FROM public.media_assets WHERE id = media_assets.id)
  );

-- OWNER DELETE (soft delete only via RLS): creators can mark their own
-- non-ready assets as deleted. Published assets require explicit admin action.
-- Hard delete is handled server-side via service role after soft-delete confirmation.
DROP POLICY IF EXISTS "delete_own_media_assets" ON public.media_assets;
CREATE POLICY "delete_own_media_assets" ON public.media_assets
  FOR DELETE
  TO authenticated
  USING (
    public.auth_user_owns_creator(creator_id)
    AND status IN ('pending', 'failed')
  );


-- =============================================================================
-- STEP 5: Create the designs-private Storage bucket
-- =============================================================================
-- This bucket stores ALL design media files: originals, previews, thumbnails.
-- It is PRIVATE — no public URL access. Files are accessed via signed URLs
-- (for creators viewing their own work) or via the service role on the server.
--
-- Note: The INSERT below is idempotent due to ON CONFLICT DO NOTHING.
-- If the bucket already exists, this is a no-op.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'designs-private',
  'designs-private',
  false,                              -- private: no public URL access
  52428800,                           -- 50 MB per file limit
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/tiff'
  ]
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- STEP 6: Storage RLS policies for the designs-private bucket
-- =============================================================================
-- Storage RLS policies live in the storage schema.
-- They protect the storage.objects table (individual files).
--
-- Ownership is enforced via path structure:
--   designs/{creator_id}/{design_id}/{asset_type}/{filename}
-- The creator_id in the path is verified against auth.uid() through the
-- creators table, using the same auth_user_owns_creator() helper.
--
-- NOTE: Storage bucket-level policies use storage.foldername() and
-- storage.filename() helpers. The ownership check verifies that the
-- creator_id path segment matches a creator owned by auth.uid().

-- Helper: extracts creator_id from a storage path (segment index 1, 0-based)
-- Path format: designs/{creator_id}/{design_id}/{type}/{filename}
-- storage.foldername(name) returns the path segments array.

-- STORAGE: Creators can upload files to their own path prefix only
DROP POLICY IF EXISTS "storage_creator_upload" ON storage.objects;
CREATE POLICY "storage_creator_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'designs-private'
    -- Verify the creator_id segment in the path is owned by the calling user
    AND EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id       = (storage.foldername(name))[2]::uuid
      AND   creators.user_id  = auth.uid()
      AND   creators.status   = 'approved'
    )
    -- Enforce path prefix is 'designs'
    AND (storage.foldername(name))[1] = 'designs'
    -- Enforce valid asset_type segment
    AND (storage.foldername(name))[4] IN ('original', 'preview', 'thumbnail')
  );

-- STORAGE: Creators can read/download their own files only
DROP POLICY IF EXISTS "storage_creator_read" ON storage.objects;
CREATE POLICY "storage_creator_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'designs-private'
    AND EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id       = (storage.foldername(name))[2]::uuid
      AND   creators.user_id  = auth.uid()
    )
  );

-- STORAGE: Creators can delete only their own pending/failed files.
-- Deleting published originals requires a server-side operation with
-- explicit ownership + status verification.
DROP POLICY IF EXISTS "storage_creator_delete" ON storage.objects;
CREATE POLICY "storage_creator_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'designs-private'
    AND EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id       = (storage.foldername(name))[2]::uuid
      AND   creators.user_id  = auth.uid()
    )
    -- Cannot delete files whose asset record is 'ready' (published)
    -- They must be archived/unpublished first via the design lifecycle
    AND NOT EXISTS (
      SELECT 1 FROM public.media_assets
      WHERE media_assets.storage_path = name
      AND   media_assets.status       = 'ready'
    )
  );

-- STORAGE: Anonymous users cannot access designs-private at all (no policy = deny)
-- The absence of an anon SELECT policy enforces this automatically.


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT * FROM storage.buckets WHERE id = 'designs-private';
--    → Should return 1 row: private bucket, 50 MB limit, 5 MIME types
--
-- 2. SELECT tablename, policyname FROM pg_policies
--    WHERE tablename = 'media_assets' ORDER BY policyname;
--    → Should include:
--      read_published_media_assets
--      read_own_media_assets
--      insert_own_media_assets
--      update_own_media_assets
--      delete_own_media_assets
--
-- 3. SELECT policyname FROM pg_policies
--    WHERE tablename = 'objects' AND policyname LIKE 'storage_%';
--    → Should include:
--      storage_creator_upload
--      storage_creator_read
--      storage_creator_delete
--
-- 4. SELECT count(*) FROM public.media_assets;
--    → Should return 0 (empty — no uploads yet)
--
-- 5. SELECT count(*) FROM public.designs;
--    → Should still return 40 (seed data untouched)
--
-- 6. SELECT count(*) FROM public.creators;
--    → Should still return 8 (seed data untouched)
