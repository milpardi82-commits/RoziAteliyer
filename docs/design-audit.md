# Design System Audit — Morrow Marketplace

**Date:** Phase 4 Implementation  
**Author:** Phase 4 Design Architect  
**Status:** Pre-implementation analysis

---

## 1. Current `designs` Table Schema

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `creator_id` | uuid | NOT NULL FK → `creators(id)` ON DELETE CASCADE | Correct ownership link |
| `shop_id` | uuid | nullable FK → `shops(id)` ON DELETE SET NULL | Optional shop membership |
| `title` | text | NOT NULL | |
| `slug` | text | UNIQUE NOT NULL | URL identifier |
| `description` | text | nullable | |
| `image_url` | text | NOT NULL | Main preview |
| `thumbnail_url` | text | nullable | |
| `colors` | text[] | NOT NULL DEFAULT '{}' | Dominant hex colours |
| `width_px` | integer | NOT NULL DEFAULT 1500 | |
| `height_px` | integer | NOT NULL DEFAULT 1500 | |
| `dpi` | integer | NOT NULL DEFAULT 150 | |
| `is_public` | boolean | NOT NULL DEFAULT true | **Visibility gate** |
| `is_featured` | boolean | NOT NULL DEFAULT false | Editorial flag |
| `view_count` | integer | NOT NULL DEFAULT 0 | Denormalised |
| `favorite_count` | integer | NOT NULL DEFAULT 0 | Denormalised |
| `review_count` | integer | NOT NULL DEFAULT 0 | Denormalised |
| `avg_rating` | numeric(3,2) | NOT NULL DEFAULT 0 | Denormalised |
| `published_at` | timestamptz | NOT NULL DEFAULT now() | Set at creation — not gated |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Maintained by trigger |

**Missing:**
- `status` column — no lifecycle (draft / pending_review / approved / published / archived)
- `reviewed_at` — no audit trail for approval
- `admin_note` — no reviewer feedback path

---

## 2. Existing Relationships

```
creators (id)
    │ 1:N
    ▼
designs (creator_id)
    │ N:1 (optional)
    ├──▶ shops (shop_id, nullable)
    │
    ├──▶ design_categories (design_id) ──▶ categories
    ├──▶ design_tags       (design_id) ──▶ tags
    │
    ├──▶ reviews           (design_id)
    ├──▶ favorites         (design_id)
    ├──▶ user_favorites    (design_id)
    └──▶ collection_items  (design_id) ──▶ collections
```

### Categories Table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | UNIQUE |
| slug | text | UNIQUE |
| description | text | nullable |
| icon_name | text | Lucide icon name |
| design_count | integer | Denormalised |

**Populated with 8 categories.** No status / ordering column. `design_count` is manually set in seed — not maintained by trigger.

### Tags Table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | UNIQUE |
| slug | text | UNIQUE |

**20 tags seeded.** No `use_count` column — no way to sort by popularity.

### Collections Table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| creator_id | uuid | nullable FK → creators |
| name | text | NOT NULL |
| description | text | nullable |
| cover_image_url | text | nullable |
| is_public | boolean | DEFAULT true |
| item_count | integer | DEFAULT 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

**Missing:** `status` column (draft / published / archived). No ordering column.

---

## 3. Existing RLS Policies on `designs`

| Policy | Operation | Condition | Problem |
|--------|-----------|-----------|---------|
| `read_public_designs` | SELECT | `is_public = true` | Passes ALL public designs — no status check. Any row with `is_public=true` is exposed, even drafts |
| `insert_own_designs` | INSERT | `auth.uid() = creator_id` | Ownership correct. But allows inserting with `is_public=true` immediately — no draft enforcement |
| `update_own_designs` | UPDATE | `auth.uid() = creator_id` | Correct ownership. BUT a creator can set `is_public=true` themselves — bypasses review |
| `delete_own_designs` | DELETE | `auth.uid() = creator_id` | Correct |

**Critical RLS gaps:**
1. A creator can INSERT `is_public = true` → design is immediately live without review.
2. A creator can UPDATE `is_public = true` on any of their designs → same bypass.
3. No restriction on setting `status = 'published'` because the column doesn't exist yet.
4. `creator_id` here is the `creators.id` (standalone UUID) — in the current seed data this is a static UUID. In the real system, ownership must use `auth.uid()` matched against `creators.user_id`, since `creators.id ≠ auth.uid()`.

### Critical Ownership Bug (P0)
The existing ownership policy uses:
```sql
USING (auth.uid() = creator_id)
```
But `creators.id` is a **standalone UUID**, not `auth.users.id`. It was decoupled in migration 2.

So `auth.uid()` (which is an `auth.users.id`) can **never equal** `designs.creator_id` (which is a `creators.id`).

For real authenticated users (Phase 3+), this means:
- A logged-in creator **cannot insert/update/delete their own designs** through these policies.
- Only the 8 seed creators (standalone) are affected — they have no auth link, so this has been invisible.

**Fix required:** Rewrite ownership checks to use a subquery through `creators.user_id`.

---

## 4. Existing RLS on Related Tables

### `design_categories` / `design_tags`
Both use:
```sql
EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid())
```
Same bug — `designs.creator_id` cannot equal `auth.uid()` for real users.

### `collections`
Uses `auth.uid() = creator_id` — same structural bug since `collections.creator_id` references `creators.id`.

---

## 5. Problems Identified

### P0 — Ownership RLS Bug (CRITICAL)
**Severity: P0 — blocks all real creator operations**  
All `insert/update/delete` policies on `designs`, `design_categories`, `design_tags`, `collections`, `collection_items` use `auth.uid() = creator_id` / `auth.uid() = designs.creator_id`.

Since `creators.id` is a standalone UUID (≠ `auth.users.id`), authenticated users can never satisfy these policies.

**Fix:** Use `EXISTS (SELECT 1 FROM creators WHERE creators.id = creator_id AND creators.user_id = auth.uid())`.

### P1 — No Design Status Lifecycle
**Severity: HIGH**  
`is_public` is a single boolean. There is no concept of draft / review / published / archived. A creator can immediately expose a design without any review.

### P2 — Creators Can Self-Publish
**Severity: HIGH**  
`insert_own_designs` has no guard against inserting `is_public = true`. `update_own_designs` has no guard against setting `is_public = true`.

### P3 — `published_at` Set at INSERT Time
**Severity: MEDIUM**  
`published_at` defaults to `now()` at insert. This means draft designs have a "published at" date even before they are approved. The field should only be set when `status` transitions to `published`.

### P4 — No `reviewed_at` / `admin_note` on Designs
**Severity: LOW** (needed for future admin workflow)  
No audit trail for when a design was reviewed or what feedback was given.

### P5 — No `status` on Collections
**Severity: LOW**  
Collections have `is_public` but no status lifecycle (draft / published / archived).

### P6 — Tag `use_count` Missing
**Severity: LOW**  
No way to sort tags by popularity for the filter UI.

### P7 — `category.design_count` Not Trigger-Maintained
**Severity: LOW**  
`design_count` on `categories` is manually set in seed data. It will drift as designs are added/removed.

---

## 6. Recommended Changes

### Required (Phase 4):
1. Add `status` column to `designs` — `draft | pending_review | approved | published | archived`. DEFAULT `published` to preserve seed data.
2. Add `reviewed_at` and `admin_note` to `designs` for future admin workflow.
3. Fix ownership RLS on `designs`, `design_categories`, `design_tags`, `collections`, `collection_items` to use the `creators.user_id` subquery pattern.
4. Add a creator-facing SELECT policy so creators can see their own drafts/pending designs.
5. Block creators from self-publishing: `insert_own_designs` must enforce `status IN ('draft', 'pending_review')` and `is_public = false`.
6. Block status escalation: creators cannot UPDATE `status` to `approved` or `published`.
7. Add `status` column to `collections` — `draft | published | archived`. DEFAULT `published`.
8. Add `use_count` to `tags` for popularity-based sorting.
9. `SECURITY DEFINER` function `publish_design(design_id)` for admin use.

### Not Required Now (future):
- UI for design upload / management
- Image storage (Supabase Storage)
- Commerce fields (price, license type)
- Category `design_count` auto-maintenance trigger

---

## 7. Migration Risks

| Risk | Level | Mitigation |
|------|-------|-----------|
| Adding `status` with DEFAULT 'published' | LOW | All 40 seed designs remain visible |
| Rewriting designs RLS policies | MEDIUM | New policies are drop-and-replace; seed data unaffected (seed creators have no auth link — anon reads still work) |
| Adding `reviewed_at` nullable | SAFE | Existing rows get NULL |
| Rewriting collections/design_categories RLS | MEDIUM | Same as above; seed data uses anon read policies which are unchanged |
| Adding `use_count` to tags | SAFE | DEFAULT 0 |

---

## 8. Rollback SQL

```sql
-- Rollback Phase 4 design foundation
ALTER TABLE designs     DROP COLUMN IF EXISTS status;
ALTER TABLE designs     DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE designs     DROP COLUMN IF EXISTS admin_note;
ALTER TABLE collections DROP COLUMN IF EXISTS status;
ALTER TABLE tags        DROP COLUMN IF EXISTS use_count;

DROP FUNCTION IF EXISTS public.publish_design(uuid);
DROP FUNCTION IF EXISTS public.submit_design_for_review(uuid);

-- Restore original designs policies
DROP POLICY IF EXISTS "read_published_designs"         ON designs;
DROP POLICY IF EXISTS "read_own_designs"               ON designs;
DROP POLICY IF EXISTS "insert_own_designs_v4"          ON designs;
DROP POLICY IF EXISTS "update_own_designs_v4"          ON designs;
DROP POLICY IF EXISTS "delete_own_designs_v4"          ON designs;
CREATE POLICY "read_public_designs" ON designs FOR SELECT
  TO anon, authenticated USING (is_public = true);
CREATE POLICY "insert_own_designs"  ON designs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "update_own_designs"  ON designs FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "delete_own_designs"  ON designs FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- Restore design_categories / design_tags policies
DROP POLICY IF EXISTS "insert_own_design_categories_v4" ON design_categories;
DROP POLICY IF EXISTS "delete_own_design_categories_v4" ON design_categories;
DROP POLICY IF EXISTS "insert_own_design_tags_v4"       ON design_tags;
DROP POLICY IF EXISTS "delete_own_design_tags_v4"       ON design_tags;
CREATE POLICY "insert_own_design_categories" ON design_categories FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "delete_own_design_categories" ON design_categories FOR DELETE
  TO authenticated USING    (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "insert_own_design_tags" ON design_tags FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
CREATE POLICY "delete_own_design_tags" ON design_tags FOR DELETE
  TO authenticated USING    (EXISTS (SELECT 1 FROM designs WHERE designs.id = design_id AND designs.creator_id = auth.uid()));
```
