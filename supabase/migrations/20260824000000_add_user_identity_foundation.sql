/*
# Phase 2: User Identity Foundation

## Overview
Adds user_profiles and user_favorites tables to support authenticated users
who are NOT creators. Every registered user gets a profile automatically
via a trigger on auth.users insert.

## Changes

### New Tables

#### user_profiles
- Stores identity for ALL registered users (creators and non-creators)
- PK = auth.users.id (1-to-1 with auth)
- username: unique, nullable (set by user after registration)
- display_name: nullable
- avatar_url: nullable
- bio: nullable
- language_preference: 'fa' | 'en', nullable
- created_at, updated_at

#### user_favorites
- Persists design favorites for authenticated users
- Uses auth.uid() directly — no creator_id dependency
- Separate from existing `favorites` table (which requires creator_id FK)
- user_id (uuid, FK to auth.users)
- design_id (uuid, FK to designs)
- created_at
- UNIQUE (user_id, design_id)

### New Trigger
- handle_new_user(): inserts a row into user_profiles when a new auth.users row is created
- Called via ON INSERT ON auth.users

## Risk Assessment
- Risk Level: SAFE
- All changes are ADDITIVE — no existing tables, columns, or policies modified
- Existing marketplace data is completely unaffected
- Rollback: DROP TABLE user_favorites; DROP TABLE user_profiles; DROP TRIGGER/FUNCTION

## Rollback SQL
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_profiles;
```
*/

-- ===== USER_PROFILES =====
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  language_preference text CHECK (language_preference IN ('fa', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles
DROP POLICY IF EXISTS "read_user_profiles" ON user_profiles;
CREATE POLICY "read_user_profiles" ON user_profiles FOR SELECT
  TO anon, authenticated USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Prevent direct inserts — the trigger handles creation
DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== USER_FAVORITES =====
-- Separate from the existing `favorites` table (which requires a creator_id FK).
-- This table works for ANY authenticated user.
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, design_id)
);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites; anon cannot
DROP POLICY IF EXISTS "read_own_user_favorites" ON user_favorites;
CREATE POLICY "read_own_user_favorites" ON user_favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Users can add to their own favorites
DROP POLICY IF EXISTS "insert_own_user_favorites" ON user_favorites;
CREATE POLICY "insert_own_user_favorites" ON user_favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own favorites
DROP POLICY IF EXISTS "delete_own_user_favorites" ON user_favorites;
CREATE POLICY "delete_own_user_favorites" ON user_favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_design_id ON user_favorites(design_id);
