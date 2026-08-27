/*
# Adjust creators table for standalone marketplace display

## Overview
The creators table initially had a FK to auth.users, which prevents seeding sample
marketplace data without real auth accounts. Since auth is not yet implemented
(future phase), this migration makes creators a standalone table with its own UUID PK.
A nullable user_id column is added for future auth linking.

## Changes
- creators.id: changed from FK to auth.users to standalone uuid PK
- Added creators.user_id (nullable, for future auth link)
- Added updated_at trigger for creators, shops, designs, collections, reviews
*/

-- Remove FK constraint and make id standalone
ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_id_fkey;
ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_id_auth_users_fkey;

-- Add user_id column for future auth linking
ALTER TABLE creators ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update policies to use user_id instead of id for ownership checks
DROP POLICY IF EXISTS "insert_own_creator" ON creators;
CREATE POLICY "insert_own_creator" ON creators FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_creator" ON creators;
CREATE POLICY "update_own_creator" ON creators FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_creators_updated_at ON creators;
CREATE TRIGGER trigger_creators_updated_at BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_shops_updated_at ON shops;
CREATE TRIGGER trigger_shops_updated_at BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_designs_updated_at ON designs;
CREATE TRIGGER trigger_designs_updated_at BEFORE UPDATE ON designs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_collections_updated_at ON collections;
CREATE TRIGGER trigger_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_reviews_updated_at ON reviews;
CREATE TRIGGER trigger_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();