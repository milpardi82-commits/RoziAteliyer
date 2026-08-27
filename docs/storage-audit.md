# Storage Audit — Morrow Marketplace
# Phase 5: Media & Storage Architecture

**Date:** Phase 5 Implementation
**Author:** Phase 5 Storage Architect
**Status:** Pre-implementation audit

---

## 1. Current Supabase Storage Configuration

### Existing Buckets

**Finding:** No Supabase Storage buckets have been created yet.

The current project does not use Supabase Storage at all. All image references
in the database are external URLs pointing to Pexels stock photography CDN.

This is expected for a seed/demo phase. No storage infrastructure exists to audit.

---

## 2. Existing Image URL Patterns

### `creators` table

| Column | Type | Example value |
|--------|------|---------------|
| `avatar_url` | text (nullable) | `https://images.pexels.com/photos/5393535/...` |
| `banner_url` | text (nullable) | `https://images.pexels.com/photos/8381900/...` |

All 8 seed creators reference Pexels URLs. These are external CDN links, not
Supabase Storage paths. They are **read-only seed data** — must not be modified.

### `designs` table

| Column | Type | Example value |
|--------|------|---------------|
| `image_url` | text (NOT NULL) | `https://images.pexels.com/photos/5117322/...` |
| `thumbnail_url` | text (nullable) | `https://images.pexels.com/photos/5117322/...w=400...` |

All 40 seed designs reference Pexels URLs with query-string resizing.
These are **not** Supabase Storage paths.

The existing `image_url` and `thumbnail_url` columns on `designs` are plain
`text` columns — no storage path convention, no foreign key to any asset table.

### `shops` table

| Column | Type | Notes |
|--------|------|-------|
| `banner_url` | text (nullable) | Pexels URLs in seed data |

### `collections` table

| Column | Type | Notes |
|--------|------|-------|
| `cover_image_url` | text (nullable) | Pexels URLs in seed data |

### `user_profiles` table

| Column | Type | Notes |
|--------|------|-------|
| `avatar_url` | text (nullable) | Not yet populated |

---

## 3. Existing Storage RLS Policies

**Finding:** None. No Supabase Storage buckets exist, so no Storage RLS policies exist.

---

## 4. Existing File References

**All image references in the database are external Pexels URLs.**

No files exist in Supabase Storage. No `storage.objects` rows exist for this project.

---

## 5. Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| Overwriting seed data image URLs | LOW | We do NOT modify seed data; `media_assets` is a separate table |
| Creating buckets that conflict with existing ones | NONE | No buckets exist |
| Breaking existing queries using `image_url` / `thumbnail_url` | NONE | We do not modify those columns |
| Cross-creator file access | MEDIUM | Must be addressed by RLS in the new bucket |
| Storage path traversal attacks | MEDIUM | Must enforce deterministic server-generated paths |
| Original design file exposure | HIGH | Private originals must never be publicly accessible |

---

## 6. Recommended Architecture

### Bucket Strategy

```
designs-private    (private bucket)
  └── designs/{creator_id}/{design_id}/original/{filename}

designs-public     (public bucket, for future use)
  └── designs/{creator_id}/{design_id}/preview/{filename}
  └── designs/{creator_id}/{design_id}/thumbnail/{filename}
```

**Decision: Start with `designs-private` only.**

At this architecture phase, we create a single private bucket. Public
delivery of previews/thumbnails will be enabled in a future phase once
image processing infrastructure is in place.

Rationale:
- A private bucket is the safest default.
- All originals must remain private regardless of design status.
- Public previews require processed variants (not the raw original) — this
  processing pipeline does not exist yet.
- A single bucket with deterministic path prefixes is easier to manage
  than multiple buckets at this stage.

### Database Model

A new `media_assets` table will be created as a separate domain model.
Existing `designs.image_url` and `designs.thumbnail_url` columns remain
untouched — they continue to serve the existing 40 seed designs.

Future: when a creator uploads a real design, `image_url` and `thumbnail_url`
will be populated from the resolved `media_assets` CDN path, not from Pexels.

---

## 7. Migration / Rollback Considerations

### What this phase adds:

1. One new Supabase Storage bucket: `designs-private` (private)
2. One new database table: `media_assets`
3. Storage RLS policies on `designs-private`
4. New migration file (additive only)

### What this phase does NOT change:

- No modifications to existing tables
- No modifications to existing RLS policies
- No modification of existing seed data
- No deletion of any existing Supabase objects
- Existing `image_url` / `thumbnail_url` columns remain as-is

### Rollback procedure:

```sql
-- Database rollback
DROP TABLE IF EXISTS media_assets;

-- Storage rollback (Supabase Dashboard or management API)
-- Delete all files in designs-private bucket
-- Delete designs-private bucket
```

---

## 8. Summary

| Area | Current State | After Phase 5 |
|------|--------------|---------------|
| Storage buckets | None | `designs-private` (private) |
| Storage RLS | None | Owner-scoped upload/read/delete |
| Media domain model | None (image URLs in designs) | `media_assets` table |
| Image URL source | External Pexels URLs (seed) | Pexels (seed) + Supabase Storage (new uploads) |
| Originals access | N/A | Private — creator + server only |
| Public previews | Pexels CDN (seed only) | Future phase |
| Path convention | None | Deterministic: `designs/{creator_id}/{design_id}/{type}/{filename}` |
