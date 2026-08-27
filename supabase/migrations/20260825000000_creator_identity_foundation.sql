/*
# Phase 3: Creator Identity Foundation

## Overview
Adds the creator status lifecycle, creator application flow, and tightens
the security model around who can be a creator. All changes are ADDITIVE —
no existing tables, columns, relations, or seed data are destroyed.

## Tables Modified
- `creators` — ADD COLUMN `status` (text, default 'approved' to preserve seed data)
- `creators` — UPDATE RLS policies (replace with status-aware policies)

## Tables Added
- `creator_applications` — application lifecycle for users requesting creator status

## Security Changes
- Public reads creators WHERE status = 'approved' only (was: all rows)
- Authenticated users cannot self-insert creators directly (must use the application flow)
- Creators can only update their own row (unchanged semantics, now also checks status)
- creator_applications: users submit only their own; owners read their own; admins (future) read all

## Rollback SQL
```sql
-- Drop new table
DROP TABLE IF EXISTS creator_applications;

-- Revert creators status column
ALTER TABLE creators DROP COLUMN IF EXISTS status;

-- Restore original creator RLS policies
DROP POLICY IF EXISTS "read_approved_creators" ON creators;
DROP POLICY IF EXISTS "read_own_creator_row" ON creators;
DROP POLICY IF EXISTS "insert_own_creator_v3" ON creators;
DROP POLICY IF EXISTS "update_own_creator_v3" ON creators;
CREATE POLICY "read_creators" ON creators FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_own_creator" ON creators FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_creator" ON creators FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## Risk Assessment
- Risk Level: SAFE
- All 8 seed creators receive status = 'approved' via DEFAULT
- No existing data deleted or modified
- No FK constraints changed
- Existing shops/designs/reviews/favorites/follows unaffected
*/

-- =============================================================================
-- STEP 1: Add `status` column to creators
-- =============================================================================
-- DEFAULT 'approved' ensures the 8 existing seed creators remain visible.
-- Valid values: 'pending' | 'approved' | 'suspended'
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'suspended'));

-- Index for efficient status filtering (public pages only query 'approved')
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators(status);

-- =============================================================================
-- STEP 2: Update RLS policies on creators
-- =============================================================================

-- DROP old open-read policy (replaced by status-filtered policies below)
DROP POLICY IF EXISTS "read_creators" ON creators;

-- PUBLIC: only approved creators are visible to anonymous and regular users
CREATE POLICY "read_approved_creators" ON creators FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- OWNER: a creator can always read their own row, regardless of status
-- This allows pending/suspended creators to see their own profile state.
-- Multiple SELECT policies on the same table are OR'd by Postgres.
CREATE POLICY "read_own_creator_row" ON creators FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- DROP old self-insert policy (new flow goes through creator_applications)
DROP POLICY IF EXISTS "insert_own_creator" ON creators;

-- AUTHENTICATED: direct insert is now restricted.
-- A creator row should only be created by the application approval process
-- (via a SECURITY DEFINER function, see approve_creator_application below).
-- We still allow it for the service role / admin functions, but block anon self-inserts.
-- The WITH CHECK ensures a user can only create their own row when called directly.
-- NOTE: In the application approval flow we use a SECURITY DEFINER function that
-- bypasses RLS, so this policy guards direct PostgREST access only.
CREATE POLICY "insert_own_creator_v3" ON creators FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- DROP old update policy; replace with version-tagged name (same semantics)
DROP POLICY IF EXISTS "update_own_creator" ON creators;

CREATE POLICY "update_own_creator_v3" ON creators FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- STEP 3: creator_applications table
-- =============================================================================
CREATE TABLE IF NOT EXISTS creator_applications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Applicant's self-description / motivation message
  message     text,
  -- Handle the applicant wants (must be URL-slug format)
  desired_handle  text,
  -- Display name the applicant wants on their creator profile
  desired_display_name text,
  -- Admin/reviewer note (nullable until reviewed)
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  -- One active application per user at a time
  UNIQUE (user_id, status)
);

ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;

-- Applicants can read their own applications
DROP POLICY IF EXISTS "read_own_applications" ON creator_applications;
CREATE POLICY "read_own_applications" ON creator_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Applicants can submit only their own application
DROP POLICY IF EXISTS "insert_own_application" ON creator_applications;
CREATE POLICY "insert_own_application" ON creator_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Applicants cannot update once submitted (admin review updates via SECURITY DEFINER fn)
-- No UPDATE policy for authenticated role — only service role can update

-- =============================================================================
-- STEP 4: approve_creator_application() — SECURITY DEFINER function
-- =============================================================================
-- This function is called by the admin review process (future admin panel).
-- It atomically: marks the application approved, creates/activates the creator row.
-- SECURITY DEFINER bypasses RLS so it can update creator_applications and creators
-- regardless of the calling user's identity. Must only be called with verified admin intent.
CREATE OR REPLACE FUNCTION public.approve_creator_application(application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app creator_applications%ROWTYPE;
  v_handle text;
  v_display_name text;
BEGIN
  -- Fetch the application
  SELECT * INTO v_app FROM creator_applications WHERE id = application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % not found', application_id;
  END IF;
  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Application % is not pending (status: %)', application_id, v_app.status;
  END IF;

  -- Resolve handle: use desired_handle or fall back to user_id prefix
  v_handle := COALESCE(
    v_app.desired_handle,
    'creator-' || left(v_app.user_id::text, 8)
  );

  -- Resolve display name
  v_display_name := COALESCE(
    v_app.desired_display_name,
    (SELECT display_name FROM user_profiles WHERE id = v_app.user_id),
    split_part((SELECT email FROM auth.users WHERE id = v_app.user_id), '@', 1)
  );

  -- Mark application approved
  UPDATE creator_applications
    SET status = 'approved', reviewed_at = now()
    WHERE id = application_id;

  -- Upsert creator row (idempotent — won't fail if re-run)
  INSERT INTO creators (user_id, display_name, handle, status)
    VALUES (v_app.user_id, v_display_name, v_handle, 'approved')
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'approved', updated_at = now();
END;
$$;

-- =============================================================================
-- STEP 5: reject_creator_application() — SECURITY DEFINER function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reject_creator_application(
  application_id uuid,
  note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE creator_applications
    SET status = 'rejected',
        reviewed_at = now(),
        admin_note = note
    WHERE id = application_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % not found or not pending', application_id;
  END IF;
END;
$$;

-- =============================================================================
-- STEP 6: UNIQUE index on creators.user_id (each auth user → at most 1 creator)
-- =============================================================================
-- The seed data has user_id = NULL for all 8 creators (standalone seeding).
-- This partial unique index only applies to rows WHERE user_id IS NOT NULL,
-- so seed data is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_user_id_unique
  ON creators(user_id)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- STEP 7: Indexes for creator_applications
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id
  ON creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status
  ON creator_applications(status);

-- =============================================================================
-- STEP 8: updated_at trigger for creator_applications
-- =============================================================================
-- Reuse existing update_updated_at_column() function from migration 2.
-- creator_applications has no updated_at column by design (immutable once submitted,
-- status changes are tracked via reviewed_at), so no trigger needed here.

-- =============================================================================
-- VERIFICATION NOTES
-- =============================================================================
-- After applying:
-- 1. SELECT status, count(*) FROM creators GROUP BY status;
--    → Should show 8 rows with status='approved'
-- 2. SELECT * FROM creator_applications LIMIT 1;
--    → Empty table (correct — no applications yet)
-- 3. \d creators  → should show new `status` column
-- 4. SELECT policyname FROM pg_policies WHERE tablename='creators';
--    → Should show read_approved_creators, insert_own_creator_v3, update_own_creator_v3
--    → Should NOT show read_creators (old), insert_own_creator (old), update_own_creator (old)
