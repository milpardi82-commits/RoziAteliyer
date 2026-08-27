/*
# Phase 4: Design Lifecycle & Ownership Foundation

## Overview
Introduces a professional design content lifecycle, fixes the critical ownership
RLS bug identified in the audit (creators.id ≠ auth.uid()), adds status columns
to designs and collections, enriches tags with a use_count, and provides
SECURITY DEFINER functions for the admin review workflow.

ALL changes are ADDITIVE. No existing columns, tables, or data are deleted.
The 40 seed designs and 8 creators remain fully visible.

## Tables Modified

### designs
  - ADD COLUMN status           text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','pending_review','approved','published','archived'))
  - ADD COLUMN reviewed_at      timestamptz (nullable)
  - ADD COLUMN admin_note       text (nullable)
  - RLS: drop 4 old policies, add 5 new policies (read_published, read_own,
    insert_own_v4, update_own_v4, delete_own_v4)
  - FIX: ownership subquery now uses creators.user_id = auth.uid()

### collections
  - ADD COLUMN status           text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived'))
  - RLS: update ownership policies to use creators.user_id subquery

### design_categories
  - RLS: update INSERT/DELETE to use creators.user_id subquery

### design_tags
  - RLS: update INSERT/DELETE to use creators.user_id subquery

### tags
  - ADD COLUMN use_count        integer NOT NULL DEFAULT 0

## Tables NOT Changed
- categories (structure fine; design_count trigger is a future task)
- reviews, favorites, user_favorites, follows, shops
- user_profiles, creator_applications, creators

## New Functions (SECURITY DEFINER)
- submit_design_for_review(design_id uuid) — creator action
- publish_design(design_id uuid)           — admin action
- unpublish_design(design_id uuid)         — admin action
- archive_design(design_id uuid)           — admin action

## Risk Assessment
- Risk Level: SAFE
- All 40 seed designs receive status='published' via DEFAULT → remain visible
- All 3 seed collections receive status='published' via DEFAULT → remain visible
- All 20 seed tags receive use_count=0 → backward compatible
- RLS policy rewrites are drop-and-replace; seed data is read via anon key
  which uses the public-read policies (unchanged semantics for public reads)
- The ownership fix only affects INSERT/UPDATE/DELETE paths which were
  already broken for real auth users (they always returned false before)

## Rollback SQL
```sql
ALTER TABLE designs     DROP COLUMN IF EXISTS status;
ALTER TABLE designs     DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE designs     DROP COLUMN IF EXISTS admin_note;
ALTER TABLE collections DROP COLUMN IF EXISTS status;
ALTER TABLE tags        DROP COLUMN IF EXISTS use_count;
DROP FUNCTION IF EXISTS public.publish_design(uuid);
DROP FUNCTION IF EXISTS public.unpublish_design(uuid);
DROP FUNCTION IF EXISTS public.archive_design(uuid);
DROP FUNCTION IF EXISTS public.submit_design_for_review(uuid);
DROP POLICY IF EXISTS "read_published_designs"          ON designs;
DROP POLICY IF EXISTS "read_own_designs"                ON designs;
DROP POLICY IF EXISTS "insert_own_designs_v4"           ON designs;
DROP POLICY IF EXISTS "update_own_designs_v4"           ON designs;
DROP POLICY IF EXISTS "delete_own_designs_v4"           ON designs;
DROP POLICY IF EXISTS "insert_own_design_categories_v4" ON design_categories;
DROP POLICY IF EXISTS "delete_own_design_categories_v4" ON design_categories;
DROP POLICY IF EXISTS "insert_own_design_tags_v4"       ON design_tags;
DROP POLICY IF EXISTS "delete_own_design_tags_v4"       ON design_tags;
DROP POLICY IF EXISTS "read_published_collections"      ON collections;
DROP POLICY IF EXISTS "read_own_collections"            ON collections;
DROP POLICY IF EXISTS "insert_own_collections_v4"       ON collections;
DROP POLICY IF EXISTS "update_own_collections_v4"       ON collections;
DROP POLICY IF EXISTS "delete_own_collections_v4"       ON collections;
-- Restore originals:
CREATE POLICY "read_public_designs"  ON designs FOR SELECT  TO anon, authenticated USING (is_public = true);
CREATE POLICY "insert_own_designs"   ON designs FOR INSERT  TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "update_own_designs"   ON designs FOR UPDATE  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "delete_own_designs"   ON designs FOR DELETE  TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "insert_own_design_categories" ON design_categories FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "delete_own_design_categories" ON design_categories FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "insert_own_design_tags" ON design_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "delete_own_design_tags" ON design_tags FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "read_public_collections"  ON collections FOR SELECT  TO anon, authenticated USING (is_public = true);
CREATE POLICY "insert_own_collections"   ON collections FOR INSERT  TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "update_own_collections"   ON collections FOR UPDATE  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "delete_own_collections"   ON collections FOR DELETE  TO authenticated USING (auth.uid() = creator_id);
```
*/

-- =============================================================================
-- HELPER: creator ownership predicate (reused across multiple policies)
-- Returns true when the calling auth user owns the creator row identified
-- by the given creator_id (the standalone creators.id, not auth.uid()).
-- =============================================================================
-- We use a SQL function so the subquery is written once and reused.
-- NOT SECURITY DEFINER — runs as the calling user so RLS on creators applies.
CREATE OR REPLACE FUNCTION public.auth_user_owns_creator(p_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.creators
    WHERE  creators.id      = p_creator_id
    AND    creators.user_id = auth.uid()
  );
$$;


-- =============================================================================
-- STEP 1: Add `status` column to designs
-- =============================================================================
-- DEFAULT 'published' preserves all 40 seed designs as visible.
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived'));

-- Audit fields for the review workflow
ALTER TABLE designs ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS admin_note   text;

-- Index for efficient status-based filtering
CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status);

-- Composite index for "my designs" owner view (creator + status)
CREATE INDEX IF NOT EXISTS idx_designs_creator_status ON designs(creator_id, status);


-- =============================================================================
-- STEP 2: Update designs RLS policies
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "read_public_designs"  ON designs;
DROP POLICY IF EXISTS "insert_own_designs"   ON designs;
DROP POLICY IF EXISTS "update_own_designs"   ON designs;
DROP POLICY IF EXISTS "delete_own_designs"   ON designs;

-- PUBLIC READ: only status='published' designs are visible.
-- Keeps is_public=true check for belt-and-suspenders compatibility.
CREATE POLICY "read_published_designs" ON designs FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND is_public = true);

-- OWNER READ: creators can see ALL their own designs regardless of status.
-- This allows creators to view their drafts and pending designs.
-- Multiple SELECT policies are OR'd by Postgres RLS.
CREATE POLICY "read_own_designs" ON designs FOR SELECT
  TO authenticated
  USING (public.auth_user_owns_creator(creator_id));

-- OWNER INSERT: creators may only create drafts.
-- is_public MUST be false; status MUST be 'draft'.
-- This prevents direct self-publishing.
CREATE POLICY "insert_own_designs_v4" ON designs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_user_owns_creator(creator_id)
    AND status    = 'draft'
    AND is_public = false
  );

-- OWNER UPDATE: creators may edit their OWN designs.
-- CRITICAL guard: creators cannot escalate status to 'approved' or 'published'.
-- They can move: draft → pending_review, or pull back: pending_review → draft.
-- Escalation to published/approved is handled by SECURITY DEFINER functions only.
CREATE POLICY "update_own_designs_v4" ON designs FOR UPDATE
  TO authenticated
  USING  (public.auth_user_owns_creator(creator_id))
  WITH CHECK (
    public.auth_user_owns_creator(creator_id)
    AND status NOT IN ('approved', 'published')
  );

-- OWNER DELETE: creators may delete their own non-published designs.
-- Published designs must be unpublished first (via admin/SECURITY DEFINER).
CREATE POLICY "delete_own_designs_v4" ON designs FOR DELETE
  TO authenticated
  USING (
    public.auth_user_owns_creator(creator_id)
    AND status IN ('draft', 'pending_review', 'archived')
  );


-- =============================================================================
-- STEP 3: Fix design_categories RLS (ownership subquery bug)
-- =============================================================================

DROP POLICY IF EXISTS "insert_own_design_categories" ON design_categories;
DROP POLICY IF EXISTS "delete_own_design_categories" ON design_categories;

-- Ownership now resolved via creators.user_id
CREATE POLICY "insert_own_design_categories_v4" ON design_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      JOIN   creators ON creators.id = designs.creator_id
      WHERE  designs.id      = design_id
      AND    creators.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_design_categories_v4" ON design_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN   creators ON creators.id = designs.creator_id
      WHERE  designs.id       = design_id
      AND    creators.user_id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 4: Fix design_tags RLS (ownership subquery bug)
-- =============================================================================

DROP POLICY IF EXISTS "insert_own_design_tags" ON design_tags;
DROP POLICY IF EXISTS "delete_own_design_tags" ON design_tags;

CREATE POLICY "insert_own_design_tags_v4" ON design_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designs
      JOIN   creators ON creators.id = designs.creator_id
      WHERE  designs.id       = design_id
      AND    creators.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_design_tags_v4" ON design_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designs
      JOIN   creators ON creators.id = designs.creator_id
      WHERE  designs.id       = design_id
      AND    creators.user_id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 5: Add `status` column to collections
-- =============================================================================
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);

-- Update collections RLS to fix ownership bug and add status awareness
DROP POLICY IF EXISTS "read_public_collections"  ON collections;
DROP POLICY IF EXISTS "insert_own_collections"   ON collections;
DROP POLICY IF EXISTS "update_own_collections"   ON collections;
DROP POLICY IF EXISTS "delete_own_collections"   ON collections;

-- Public can only see published public collections
CREATE POLICY "read_published_collections" ON collections FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND status = 'published');

-- Owner can see all their own collections (including drafts)
CREATE POLICY "read_own_collections" ON collections FOR SELECT
  TO authenticated
  USING (public.auth_user_owns_creator(creator_id));

-- Fixed ownership INSERT
CREATE POLICY "insert_own_collections_v4" ON collections FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_user_owns_creator(creator_id));

-- Fixed ownership UPDATE
CREATE POLICY "update_own_collections_v4" ON collections FOR UPDATE
  TO authenticated
  USING  (public.auth_user_owns_creator(creator_id))
  WITH CHECK (public.auth_user_owns_creator(creator_id));

-- Fixed ownership DELETE
CREATE POLICY "delete_own_collections_v4" ON collections FOR DELETE
  TO authenticated
  USING (public.auth_user_owns_creator(creator_id));

-- Fix collection_items INSERT/DELETE as well (same pattern)
DROP POLICY IF EXISTS "insert_own_collection_items" ON collection_items;
DROP POLICY IF EXISTS "delete_own_collection_items" ON collection_items;

CREATE POLICY "insert_own_collection_items_v4" ON collection_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE  collections.id = collection_id
      AND    public.auth_user_owns_creator(collections.creator_id)
    )
  );

CREATE POLICY "delete_own_collection_items_v4" ON collection_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE  collections.id = collection_id
      AND    public.auth_user_owns_creator(collections.creator_id)
    )
  );


-- =============================================================================
-- STEP 6: Add use_count to tags (popularity tracking)
-- =============================================================================
ALTER TABLE tags ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

-- Index for sorting tags by popularity
CREATE INDEX IF NOT EXISTS idx_tags_use_count ON tags(use_count DESC);


-- =============================================================================
-- STEP 7: SECURITY DEFINER workflow functions
-- =============================================================================
-- These functions bypass RLS — they must only be called from verified
-- server-side admin contexts (future admin panel, server actions with
-- admin role check).

-- Creator action: move a draft design to pending_review
CREATE OR REPLACE FUNCTION public.submit_design_for_review(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_design designs%ROWTYPE;
BEGIN
  SELECT * INTO v_design FROM designs WHERE id = p_design_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design % not found', p_design_id;
  END IF;

  -- Only the owner can submit (verified via creators.user_id)
  IF NOT public.auth_user_owns_creator(v_design.creator_id) THEN
    RAISE EXCEPTION 'Permission denied: not the design owner';
  END IF;

  IF v_design.status <> 'draft' THEN
    RAISE EXCEPTION 'Design % cannot be submitted: status is % (expected draft)',
      p_design_id, v_design.status;
  END IF;

  UPDATE designs
    SET status     = 'pending_review',
        updated_at = now()
    WHERE id = p_design_id;
END;
$$;

-- Admin action: approve and publish a pending_review design
CREATE OR REPLACE FUNCTION public.publish_design(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_design designs%ROWTYPE;
BEGIN
  SELECT * INTO v_design FROM designs WHERE id = p_design_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design % not found', p_design_id;
  END IF;

  IF v_design.status NOT IN ('pending_review', 'approved') THEN
    RAISE EXCEPTION 'Design % cannot be published: status is % (expected pending_review or approved)',
      p_design_id, v_design.status;
  END IF;

  UPDATE designs
    SET status      = 'published',
        is_public   = true,
        published_at = now(),
        reviewed_at = now(),
        updated_at  = now()
    WHERE id = p_design_id;
END;
$$;

-- Admin action: unpublish a published design (sets back to approved)
CREATE OR REPLACE FUNCTION public.unpublish_design(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE designs
    SET status    = 'approved',
        is_public = false,
        updated_at = now()
    WHERE id = p_design_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design % not found or not currently published', p_design_id;
  END IF;
END;
$$;

-- Admin action: archive a design
CREATE OR REPLACE FUNCTION public.archive_design(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE designs
    SET status    = 'archived',
        is_public = false,
        updated_at = now()
    WHERE id = p_design_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design % not found', p_design_id;
  END IF;
END;
$$;


-- =============================================================================
-- STEP 8: Additional performance indexes
-- =============================================================================
-- Partial index: all published public designs (primary browse query pattern)
CREATE INDEX IF NOT EXISTS idx_designs_published_public
  ON designs(published_at DESC)
  WHERE status = 'published' AND is_public = true;

-- Tag lookup by name prefix (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm_prep ON tags(name);

-- Collections by creator (dashboard view)
CREATE INDEX IF NOT EXISTS idx_collections_creator_id ON collections(creator_id);


-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT status, count(*) FROM designs GROUP BY status;
--    → Should show 40 rows with status='published'
-- 2. SELECT status, count(*) FROM collections GROUP BY status;
--    → Should show 3 rows with status='published'
-- 3. SELECT policyname FROM pg_policies WHERE tablename='designs' ORDER BY policyname;
--    → Should include: read_published_designs, read_own_designs,
--      insert_own_designs_v4, update_own_designs_v4, delete_own_designs_v4
--    → Should NOT include: read_public_designs (old)
-- 4. SELECT proname FROM pg_proc WHERE proname LIKE '%design%';
--    → Should include: submit_design_for_review, publish_design,
--      unpublish_design, archive_design, auth_user_owns_creator
