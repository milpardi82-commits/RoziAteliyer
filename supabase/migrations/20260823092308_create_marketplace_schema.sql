/*
# Create Marketplace Schema

## Overview
This migration creates the foundational schema for a surface design marketplace platform
(similar in structure to Spoonflower, but original branding and implementation).
The marketplace is the core product. Future extensions (Portfolio, Education, Shop)
will be added in isolated boundaries later.

## New Tables

### identity
- `creators` — marketplace sellers who publish designs. Extends Supabase auth.users.
  - id (uuid, PK, references auth.users)
  - display_name (text, unique)
  - handle (text, unique, slug-style)
  - bio (text)
  - location (text)
  - avatar_url (text)
  - banner_url (text)
  - website_url (text)
  - is_verified (boolean, default false)
  - design_count (integer, default 0) — denormalized count
  - follower_count (integer, default 0) — denormalized count
  - created_at, updated_at (timestamps)

### shops
- `shops` — a creator's shop configuration.
  - id (uuid, PK)
  - creator_id (uuid, FK to creators)
  - name (text)
  - slug (text, unique)
  - description (text)
  - banner_url (text)
  - is_published (boolean, default false)
  - created_at, updated_at

### designs
- `designs` — the core product. A surface design / pattern created by a creator.
  - id (uuid, PK)
  - creator_id (uuid, FK to creators)
  - shop_id (uuid, FK to shops, nullable)
  - title (text)
  - slug (text, unique)
  - description (text)
  - image_url (text) — main preview image
  - thumbnail_url (text) — smaller preview
  - colors (text[]) — dominant colors as hex strings
  - width_px, height_px (integer) — original dimensions
  - dpi (integer) — print resolution
  - is_public (boolean, default true)
  - is_featured (boolean, default false)
  - view_count (integer, default 0)
  - favorite_count (integer, default 0) — denormalized
  - review_count (integer, default 0) — denormalized
  - avg_rating (numeric, default 0) — denormalized
  - published_at (timestamptz)
  - created_at, updated_at

### categories
- `categories` — taxonomy for designs (e.g., Floral, Geometric, Abstract).
  - id (uuid, PK)
  - name (text, unique)
  - slug (text, unique)
  - description (text)
  - icon_name (text) — lucide icon name
  - design_count (integer, default 0)
  - created_at

### design_categories
- `design_categories` — many-to-many between designs and categories.
  - design_id (uuid, FK)
  - category_id (uuid, FK)
  - PK (design_id, category_id)

### tags
- `tags` — free-form tags for designs.
  - id (uuid, PK)
  - name (text, unique)
  - slug (text, unique)
  - created_at

### design_tags
- `design_tags` — many-to-many between designs and tags.
  - design_id (uuid, FK)
  - tag_id (uuid, FK)
  - PK (design_id, tag_id)

### collections
- `collections` — curated groups of designs, created by users.
  - id (uuid, PK)
  - creator_id (uuid, FK to creators, nullable) — owner of collection
  - name (text)
  - description (text)
  - cover_image_url (text)
  - is_public (boolean, default true)
  - item_count (integer, default 0)
  - created_at, updated_at

### collection_items
- `collection_items` — designs within a collection.
  - id (uuid, PK)
  - collection_id (uuid, FK)
  - design_id (uuid, FK)
  - added_at (timestamptz)
  - UNIQUE (collection_id, design_id)

### reviews
- `reviews` — ratings and comments on designs.
  - id (uuid, PK)
  - design_id (uuid, FK)
  - creator_id (uuid, FK to creators) — reviewer
  - rating (integer, 1-5, check constraint)
  - comment (text)
  - created_at, updated_at
  - UNIQUE (design_id, creator_id) — one review per user per design

### favorites
- `favorites` — a user's liked designs.
  - id (uuid, PK)
  - creator_id (uuid, FK to creators)
  - design_id (uuid, FK)
  - created_at
  - UNIQUE (creator_id, design_id)

### follows
- `follows` — creator-to-creator follow relationships.
  - id (uuid, PK)
  - follower_id (uuid, FK to creators)
  - following_id (uuid, FK to creators)
  - created_at
  - UNIQUE (follower_id, following_id)

## Security
- RLS enabled on ALL tables.
- Policies: authenticated users can read public marketplace data (designs, creators, categories, tags, collections).
- Users can write only to their own rows (creators, designs they own, reviews they author, favorites they create, follows they initiate, collections they own).
- Anon users can read public marketplace data (public designs, published shops, public categories, tags, public collections).
- All owner columns default to auth.uid().

## Notes
1. Denormalized counts (favorite_count, view_count, etc.) are maintained via triggers for accuracy.
2. The schema is single-tenant from a marketplace perspective — all public data is visible to all users.
3. Commerce (cart, checkout, orders) is intentionally NOT included — final implementation phase.
4. Future extensions (Portfolio, Education, Shop) will be added as separate domain boundaries.
*/

-- ===== CATEGORIES =====
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon_name text,
  design_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

-- ===== CREATORS =====
CREATE TABLE IF NOT EXISTS creators (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text UNIQUE NOT NULL,
  handle text UNIQUE NOT NULL,
  bio text,
  location text,
  avatar_url text,
  banner_url text,
  website_url text,
  is_verified boolean NOT NULL DEFAULT false,
  design_count integer NOT NULL DEFAULT 0,
  follower_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_creators" ON creators;
CREATE POLICY "read_creators" ON creators FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_creator" ON creators;
CREATE POLICY "insert_own_creator" ON creators FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_creator" ON creators;
CREATE POLICY "update_own_creator" ON creators FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ===== SHOPS =====
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  banner_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_published_shops" ON shops;
CREATE POLICY "read_published_shops" ON shops FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_shop" ON shops;
CREATE POLICY "insert_own_shop" ON shops FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "update_own_shop" ON shops;
CREATE POLICY "update_own_shop" ON shops FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "delete_own_shop" ON shops;
CREATE POLICY "delete_own_shop" ON shops FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- ===== TAGS =====
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_tags" ON tags;
CREATE POLICY "read_tags" ON tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_tags" ON tags;
CREATE POLICY "insert_tags" ON tags FOR INSERT
  TO authenticated WITH CHECK (true);

-- ===== DESIGNS =====
CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  image_url text NOT NULL,
  thumbnail_url text,
  colors text[] NOT NULL DEFAULT '{}',
  width_px integer NOT NULL DEFAULT 1500,
  height_px integer NOT NULL DEFAULT 1500,
  dpi integer NOT NULL DEFAULT 150,
  is_public boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  favorite_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_public_designs" ON designs;
CREATE POLICY "read_public_designs" ON designs FOR SELECT
  TO anon, authenticated USING (is_public = true);

DROP POLICY IF EXISTS "insert_own_designs" ON designs;
CREATE POLICY "insert_own_designs" ON designs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "update_own_designs" ON designs;
CREATE POLICY "update_own_designs" ON designs FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "delete_own_designs" ON designs;
CREATE POLICY "delete_own_designs" ON designs FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- ===== DESIGN_CATEGORIES =====
CREATE TABLE IF NOT EXISTS design_categories (
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (design_id, category_id)
);

ALTER TABLE design_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_design_categories" ON design_categories;
CREATE POLICY "read_design_categories" ON design_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_design_categories" ON design_categories;
CREATE POLICY "insert_own_design_categories" ON design_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_design_categories" ON design_categories;
CREATE POLICY "delete_own_design_categories" ON design_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid())
  );

-- ===== DESIGN_TAGS =====
CREATE TABLE IF NOT EXISTS design_tags (
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (design_id, tag_id)
);

ALTER TABLE design_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_design_tags" ON design_tags;
CREATE POLICY "read_design_tags" ON design_tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_design_tags" ON design_tags;
CREATE POLICY "insert_own_design_tags" ON design_tags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_design_tags" ON design_tags;
CREATE POLICY "delete_own_design_tags" ON design_tags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid())
  );

-- ===== COLLECTIONS =====
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES creators(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_image_url text,
  is_public boolean NOT NULL DEFAULT true,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_public_collections" ON collections;
CREATE POLICY "read_public_collections" ON collections FOR SELECT
  TO anon, authenticated USING (is_public = true);

DROP POLICY IF EXISTS "insert_own_collections" ON collections;
CREATE POLICY "insert_own_collections" ON collections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "update_own_collections" ON collections;
CREATE POLICY "update_own_collections" ON collections FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "delete_own_collections" ON collections;
CREATE POLICY "delete_own_collections" ON collections FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- ===== COLLECTION_ITEMS =====
CREATE TABLE IF NOT EXISTS collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, design_id)
);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_collection_items" ON collection_items;
CREATE POLICY "read_collection_items" ON collection_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_collection_items" ON collection_items;
CREATE POLICY "insert_own_collection_items" ON collection_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM collections WHERE collections.id = collection_id AND collections.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_collection_items" ON collection_items;
CREATE POLICY "delete_own_collection_items" ON collection_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM collections WHERE collections.id = collection_id AND collections.creator_id = auth.uid())
  );

-- ===== REVIEWS =====
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, creator_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_reviews" ON reviews;
CREATE POLICY "read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
CREATE POLICY "insert_own_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
CREATE POLICY "update_own_reviews" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
CREATE POLICY "delete_own_reviews" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- ===== FAVORITES =====
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, design_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_favorites" ON favorites;
CREATE POLICY "read_favorites" ON favorites FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_favorites" ON favorites;
CREATE POLICY "insert_own_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON favorites;
CREATE POLICY "delete_own_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- ===== FOLLOWS =====
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_follows" ON follows;
CREATE POLICY "read_follows" ON follows FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_follows" ON follows;
CREATE POLICY "insert_own_follows" ON follows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "delete_own_follows" ON follows;
CREATE POLICY "delete_own_follows" ON follows FOR DELETE
  TO authenticated USING (auth.uid() = follower_id);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_designs_creator_id ON designs(creator_id);
CREATE INDEX IF NOT EXISTS idx_designs_published_at ON designs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_designs_featured ON designs(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_designs_avg_rating ON designs(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_designs_favorite_count ON designs(favorite_count DESC);
CREATE INDEX IF NOT EXISTS idx_designs_slug ON designs(slug);
CREATE INDEX IF NOT EXISTS idx_creators_handle ON creators(handle);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_reviews_design_id ON reviews(design_id);
CREATE INDEX IF NOT EXISTS idx_favorites_creator_design ON favorites(creator_id, design_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_design ON collection_items(design_id);