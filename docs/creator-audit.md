# Creator Architecture Audit — Morrow Marketplace

**Date:** Phase 3 Implementation  
**Author:** Phase 3 Creator Architect  
**Status:** Pre-implementation analysis  

---

## 1. Current Creator Architecture

### Table: `creators`

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK | **Standalone UUID** — NOT linked to `auth.users.id` |
| `user_id` | uuid | nullable FK → `auth.users(id)` ON DELETE SET NULL | Added in migration 2; used for auth ownership |
| `display_name` | text | UNIQUE NOT NULL | Duplicates `user_profiles.display_name` |
| `handle` | text | UNIQUE NOT NULL | URL slug (e.g. `elena-marchetti`) |
| `bio` | text | nullable | Duplicates `user_profiles.bio` |
| `location` | text | nullable | Not in `user_profiles` |
| `avatar_url` | text | nullable | Duplicates `user_profiles.avatar_url` |
| `banner_url` | text | nullable | Creator-specific |
| `website_url` | text | nullable | Creator-specific |
| `is_verified` | boolean | DEFAULT false | No status progression (pending/approved/suspended) |
| `design_count` | integer | DEFAULT 0 | Denormalized counter |
| `follower_count` | integer | DEFAULT 0 | Denormalized counter |
| `created_at` | timestamptz | NOT NULL | Auto set |
| `updated_at` | timestamptz | NOT NULL | Maintained by trigger |

**Missing columns:**
- `status` (pending / approved / suspended)
- `user_id` is nullable — no enforcement that a creator must be a real user

### Table: `shops`

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK | Standalone UUID |
| `creator_id` | uuid | NOT NULL FK → `creators(id)` ON DELETE CASCADE | Shop destroyed if creator deleted |
| `name` | text | NOT NULL | |
| `slug` | text | UNIQUE NOT NULL | |
| `description` | text | nullable | |
| `banner_url` | text | nullable | |
| `is_published` | boolean | DEFAULT false | |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | Maintained by trigger |

**Status:** ✅ `creator_id` FK already correctly links shops → creators.

### Table: `designs`

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `creator_id` | uuid | NOT NULL FK → `creators(id)` ON DELETE CASCADE | Correct |
| `shop_id` | uuid | nullable FK → `shops(id)` ON DELETE SET NULL | Correct |

**Status:** ✅ Correctly linked.

### Table: `reviews`

- `creator_id` FK → `creators(id)` — **semantic problem**: uses `creators` for reviewer identity instead of `user_profiles`. This means only creators can leave reviews. This is a known Phase 3+ migration target; we will NOT change it now.

### Table: `favorites`

- `creator_id` FK → `creators(id)` — same problem as reviews (non-creators cannot favorite). Already addressed in Phase 2 with `user_favorites` table. Leave as-is.

### Table: `follows`

- `follower_id` and `following_id` both FK → `creators(id)` — creator-to-creator follows. Leave as-is.

### Table: `collections`

- `creator_id` FK → `creators(id)` nullable — correct.

---

## 2. Existing RLS Policies — Creators Table

| Policy | Role | Operation | Condition |
|--------|------|-----------|-----------|
| `read_creators` | anon, authenticated | SELECT | always true |
| `insert_own_creator` | authenticated | INSERT | `auth.uid() = user_id` |
| `update_own_creator` | authenticated | UPDATE | `auth.uid() = user_id` |

**Problems:**
1. `user_id` is nullable — the INSERT policy allows inserting a row with `user_id = NULL` if the user happens to call it with a null (this fails silently, the policy returns false for null = null).
2. No `status` enforcement — any user can make themselves a creator without approval.
3. No DELETE policy — creators cannot be deleted via RLS (only by CASCADE from auth.users delete).
4. Public can read ALL creators regardless of status — leaked pending/suspended creators.

---

## 3. Problems Identified

### P1 — No Creator Status / Approval Flow  
**Severity: HIGH**  
The `creators` table has only `is_verified` (boolean), with no status lifecycle. There is no way to represent "pending application", "approved", or "suspended" states. Any authenticated user can self-insert a creator row (bypassing any approval step).

### P2 — No `creator_applications` Table  
**Severity: HIGH**  
There is no record of who applied to be a creator, when, or what happened to their application. Required for a managed onboarding flow.

### P3 — Data Duplication Between `creators` and `user_profiles`  
**Severity: MEDIUM**  
`display_name`, `bio`, and `avatar_url` exist on both tables. In Phase 2 every user gets a `user_profiles` row. A creator should reference their profile rather than duplicate it.

### P4 — `creators.id` is Standalone, Not Linked to `auth.users.id`  
**Severity: MEDIUM**  
Migration 2 decoupled `creators.id` from `auth.users.id` to allow seeding. Now `user_id` is the auth link. This is acceptable but means ownership queries must use `user_id`, not `id`. The policies already do this — it is consistent.

### P5 — `insert_own_creator` Policy Has No Status Guard  
**Severity: MEDIUM**  
The INSERT policy allows an authenticated user to create a creator row immediately. After Phase 3, creator creation should only happen via the application/approval pipeline.

### P6 — Public Can Read Unapproved Creators  
**Severity: LOW** (no unapproved seed data, but architectural gap)  
The `read_creators` policy exposes all creators regardless of status. Once status is added, public should only read `status = 'approved'` creators.

---

## 4. Required Changes for Phase 3

### Additive (safe):
1. `ALTER TABLE creators ADD COLUMN status` — `pending | approved | suspended`, default `approved` for existing seed data.
2. `CREATE TABLE creator_applications` — full application lifecycle.
3. Update `read_creators` RLS — filter to `status = 'approved'` for public.
4. Update `insert_own_creator` RLS — block direct self-insert (applications go through the applications table).
5. Add i18n dictionary keys for creator application UI.
6. New `types/creator.ts` — `CreatorStatus`, `CreatorApplication`, extended `Creator` type.
7. New `services/creator.service.ts` — full service layer.
8. New `app/[locale]/become-creator/` page — application form.

### NOT Changed:
- `creators.id` (standalone UUID) — safe to keep as-is; seed data depends on it
- All existing shop, design, review, favorites, follows, collections relationships
- All existing seed data
- All existing RLS policies on shops, designs, categories, etc.
- `user_profiles` table and trigger

---

## 5. Migration Risks

| Risk | Level | Mitigation |
|------|-------|-----------|
| Adding `status` column with DEFAULT | LOW | `DEFAULT 'approved'` keeps all 8 seed creators visible |
| Updating `read_creators` policy | LOW | New policy uses `OR` for admin override; seed data all gets `approved` |
| Changing `insert_own_creator` policy | LOW | New flow uses `creator_applications`; direct insert blocked for new rows |
| `creator_applications` table | SAFE | Pure addition, no existing FK or data affected |
| Type changes | SAFE | Additive fields; existing `Creator` type consumers still compile |

---

## 6. Rollback Plan

```sql
-- Rollback Phase 3 creator migration
ALTER TABLE creators DROP COLUMN IF EXISTS status;
DROP TABLE IF EXISTS creator_applications;
-- Restore original policies (re-run migration 20260823092336 policies)
DROP POLICY IF EXISTS "read_approved_creators" ON creators;
DROP POLICY IF EXISTS "insert_own_creator_v3" ON creators;
CREATE POLICY "read_creators" ON creators FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_own_creator" ON creators FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```

---

## 7. Architecture After Phase 3

```
auth.users (Supabase managed)
     │ 1:1
     ▼
user_profiles          ← every registered user
     │ 0..1
     ▼
creators               ← optional promotion via approved application
  status: pending | approved | suspended
     │ 1:N
     ├──▶ shops
     │      │ 1:N
     │      └──▶ designs (via shop_id, nullable)
     │
     └──▶ designs (directly via creator_id)
     │
     └──▶ collections
     │
     └──▶ follows (follower/following)

creator_applications   ← application lifecycle (user → creator)
  status: pending | approved | rejected
  reviewed_at (nullable)
  admin_note (nullable)
```
