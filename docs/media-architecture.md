# Media & Storage Architecture — Morrow Marketplace
# Phase 5 Documentation

**Date:** Phase 5 Implementation
**Author:** Phase 5 Storage Architect
**Status:** Architecture implemented — upload UI pending

---

## Table of Contents

1. [Storage Architecture](#1-storage-architecture)
2. [Bucket Strategy](#2-bucket-strategy)
3. [Database Model](#3-database-model)
4. [Ownership Model](#4-ownership-model)
5. [RLS Security Model](#5-rls-security-model)
6. [Storage Path Convention](#6-storage-path-convention)
7. [Media Lifecycle](#7-media-lifecycle)
8. [Variant Strategy](#8-variant-strategy)
9. [Security Model](#9-security-model)
10. [Future Upload Flow](#10-future-upload-flow)
11. [Performance Strategy](#12-performance-strategy)
12. [Rollback Strategy](#11-rollback-strategy)
13. [Remaining Work](#13-remaining-work)

---

## 1. Storage Architecture

### Overview

The Morrow Marketplace uses **Supabase Storage** for all design media files.
The storage infrastructure is entirely separate from the existing `designs.image_url`
and `designs.thumbnail_url` columns (which hold Pexels CDN URLs for seed data only).

### Physical Architecture

```
Supabase Storage
  └── designs-private  (private bucket, Phase 5)
        └── designs/
              └── {creator_id}/
                    └── {design_id}/
                          ├── original/    ← full-resolution upload
                          ├── preview/     ← processed variant (future)
                          └── thumbnail/   ← small variant (future)
```

### Database Architecture

```
auth.users
  └── creators          (user_id = auth.uid())
        └── designs     (creator_id = creators.id)
              └── media_assets  (design_id, creator_id)
                    └── Storage object  (storage_path)
```

### Pre-existing Image URLs (seed data)

All 40 seed designs and 8 seed creators reference **external Pexels CDN URLs**.
These are NOT Supabase Storage paths. They continue to work exactly as before.
The `media_assets` table is additive — it does not replace or interfere with
the existing `image_url` / `thumbnail_url` columns.

---

## 2. Bucket Strategy

### Phase 5 Decision: Single Private Bucket

| Bucket | Visibility | Purpose |
|--------|-----------|---------|
| `designs-private` | **Private** | All design media — originals, future variants |

**Rationale:**

- Private is the safest default. No accidental public exposure of creator work.
- Public delivery of previews/thumbnails requires processed variants. The image
  processing pipeline does not exist yet.
- A single bucket with deterministic path prefixes is simpler to manage and
  audit than multiple buckets at this stage.
- All access (including future public preview delivery) will go through signed
  URLs or server-side proxying — giving us full access control.

### Future Bucket Evolution (Phase 6+)

When the image processing pipeline exists, we will evaluate:

```
designs-private   → originals (always private)
designs-public    → processed previews and thumbnails (public CDN delivery)
```

This split will happen as an additive change. The path convention already
accommodates it by encoding the `asset_type` in the path.

### Bucket Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| Public | `false` | No anonymous access |
| File size limit | 50 MB | Covers high-res design files |
| Allowed MIME types | png, jpeg, webp, tiff, svg+xml | Design formats only |

---

## 3. Database Model

### `media_assets` Table

```sql
media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  design_id     uuid NOT NULL → designs(id) ON DELETE CASCADE
  creator_id    uuid NOT NULL → creators(id) ON DELETE CASCADE
  storage_path  text NOT NULL
  storage_bucket text NOT NULL DEFAULT 'designs-private'
  asset_type    text NOT NULL  CHECK ('original','preview','thumbnail')
  mime_type     text NOT NULL  DEFAULT 'application/octet-stream'
  file_size     bigint         (nullable until upload confirms)
  width         integer        (nullable until server inspects)
  height        integer        (nullable until server inspects)
  status        text NOT NULL  CHECK ('pending','processing','ready','failed','deleted')
  created_at    timestamptz NOT NULL DEFAULT now()
  updated_at    timestamptz NOT NULL DEFAULT now()  [trigger maintained]

  UNIQUE (design_id, asset_type, storage_path)
)
```

### Partial Unique Index

```sql
CREATE UNIQUE INDEX idx_media_assets_active_type
  ON media_assets (design_id, asset_type)
  WHERE status <> 'deleted';
```

This ensures a design can have at most **one active asset per type** at a time.
Deleted records are excluded so old files can be retained for audit purposes.

### Relationship to `designs` Table

The `media_assets` table is a **child** of `designs`. It does NOT replace
`designs.image_url` or `designs.thumbnail_url`. Those columns remain for:

- Compatibility with the 40 seed designs (Pexels URLs)
- Future: when a creator uploads a real design, the service layer will
  populate `image_url` from the resolved `media_assets.storage_path` CDN URL.

---

## 4. Ownership Model

### Ownership Chain

```
auth.users  (the authenticated session)
    │  auth.uid() = creators.user_id
    ▼
creators    (the creator profile)
    │  creators.id = designs.creator_id
    ▼
designs     (the design being managed)
    │  designs.id = media_assets.design_id
    │  designs.creator_id = media_assets.creator_id
    ▼
media_assets  (the file record)
    │  storage_path = designs/{creator_id}/{design_id}/{type}/{filename}
    ▼
Storage object  (the physical file)
```

### Ownership Verification Rules

1. **Never trust client-supplied `creator_id`.**
   Always resolve `creator_id` server-side via `creators.user_id = auth.uid()`.

2. **Never trust client-supplied storage paths.**
   Always generate paths server-side via `buildStoragePath()`.

3. **Double-check consistency.**
   The `creator_id` in the storage path must match `media_assets.creator_id`.
   The `design_id` in the storage path must match `media_assets.design_id`.

4. **Storage RLS verifies path ownership independently.**
   Even if an API call passes validation, the Storage RLS policy re-verifies
   the creator_id path segment against the `creators` table.

### Helper Function

```sql
-- Defined in migration 20260826000000 (Phase 4)
-- Returns true if auth.uid() owns the given creators.id
public.auth_user_owns_creator(p_creator_id uuid) → boolean
```

---

## 5. RLS Security Model

### `media_assets` Table Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| `read_published_media_assets` | SELECT | `status='ready'` AND `asset_type IN ('preview','thumbnail')` AND design is published |
| `read_own_media_assets` | SELECT | `auth_user_owns_creator(creator_id)` |
| `insert_own_media_assets` | INSERT | `auth_user_owns_creator(creator_id)` AND design owned by same creator |
| `update_own_media_assets` | UPDATE | Owner only; immutable fields (design_id, creator_id, storage_path) enforced |
| `delete_own_media_assets` | DELETE | Owner only AND status IN ('pending', 'failed') only |

### `storage.objects` Policies (designs-private bucket)

| Policy | Operation | Rule |
|--------|-----------|------|
| `storage_creator_upload` | INSERT | Path segment 2 is a creator_id owned by auth.uid(); path follows convention |
| `storage_creator_read` | SELECT | Path segment 2 is a creator_id owned by auth.uid() |
| `storage_creator_delete` | DELETE | Owner AND no 'ready' media_asset record references this path |

### What Is NOT Allowed

| Action | Enforced By |
|--------|------------|
| Anonymous upload | No anon INSERT policy on storage |
| Cross-creator upload | Storage RLS verifies creator_id in path |
| Upload to another creator's design path | Storage path pattern + media_assets INSERT policy |
| Read another creator's private original | No public SELECT on storage; only owner can read |
| Delete a published asset directly | DELETE policy: only 'pending'/'failed' status allowed |
| Bypass ownership via client-supplied creator_id | Server always resolves via auth.uid() → creators.user_id |

---

## 6. Storage Path Convention

### Format

```
designs/{creator_id}/{design_id}/{asset_type}/{filename}
```

### Components

| Segment | Source | Notes |
|---------|--------|-------|
| `designs` | Literal | Fixed prefix — all design media lives here |
| `{creator_id}` | `creators.id` (server-resolved) | Standalone UUID — enables creator-level cleanup |
| `{design_id}` | `designs.id` (server-resolved) | Enables design-level cleanup |
| `{asset_type}` | `'original' \| 'preview' \| 'thumbnail'` | Logical variant |
| `{filename}` | Sanitised original filename | Server-sanitised via `sanitiseFilename()` |

### Examples

```
designs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/
  d1e2f3a4-b5c6-7890-dcba-fedcba098765/
  original/
  iranian_floral_pattern.png

designs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/
  d1e2f3a4-b5c6-7890-dcba-fedcba098765/
  preview/
  iranian_floral_pattern_preview.jpg

designs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/
  d1e2f3a4-b5c6-7890-dcba-fedcba098765/
  thumbnail/
  iranian_floral_pattern_thumb.jpg
```

### Filename Sanitisation Rules

The `sanitiseFilename()` function enforces:

- All path separators (`/`, `\`) → `_`
- Path traversal sequences (`..`) → `_`
- Non-alphanumeric characters except `.`, `-`, `_` → `_`
- Result is lowercased

### Properties

| Property | Status |
|----------|--------|
| Deterministic (same inputs = same path) | ✅ |
| No random/uncontrolled paths | ✅ |
| No client-provided path components | ✅ |
| No path traversal risk | ✅ |
| Easy cleanup by design (prefix: `designs/{cid}/{did}/`) | ✅ |
| Easy cleanup by creator (prefix: `designs/{cid}/`) | ✅ |
| CDN-ready (stable, predictable paths) | ✅ |

---

## 7. Media Lifecycle

### Asset Status Flow

```
[upload intent created]
        │
        ▼
    pending
        │  ← upload begins
        ▼
   processing   ← (future: image variant generation)
        │
        ├──► ready      ← upload/processing successful
        │
        └──► failed     ← upload/processing error (creator can retry or delete)

    ready
        │  ← creator replaces image / design archived
        ▼
    deleted    ← logical delete; physical cleanup is async
```

### Lifecycle Events & Media Impact

| Event | Media Action | Notes |
|-------|-------------|-------|
| Draft created | No media yet | `media_assets` record not created until upload starts |
| Upload begins | Record inserted with `status='pending'` | Physical upload then follows |
| Upload succeeds | Status → `'ready'` | `designs.image_url` / `thumbnail_url` updated from path |
| Upload fails | Status → `'failed'` | Creator can retry; old record is reused or replaced |
| Creator replaces image | Old record → `'deleted'`; new record inserted | Async cleanup of old file |
| Design draft deleted | CASCADE deletes `media_assets` rows | Storage file cleanup via async job |
| Design rejected | Assets remain; design stays `status='pending_review'` | Creator can revise and resubmit |
| Design archived | Assets remain; `is_public=false` | Files still stored; access removed from public |
| Creator account suspended | Assets inaccessible via RLS | Files physically remain pending review |
| Creator account deleted | CASCADE deletes `media_assets`; files need cleanup | Async cleanup job |

### Cleanup Safety Rules

1. **Never auto-delete** storage files without verifying the `media_assets` record is `'deleted'`.
2. **Never hard-delete** a `media_assets` record while a published design references it.
3. **Cascade deletes** on the database handle record cleanup automatically.
4. **Physical file cleanup** is a separate async process — not triggered automatically in Phase 5.
5. **Soft delete first** — always set `status='deleted'` before scheduling physical cleanup.

---

## 8. Variant Strategy

### Variant → Context Mapping

| UI Context | Variant | Asset Type | Access | Notes |
|-----------|---------|-----------|--------|-------|
| Marketplace grid cards | `card` | `thumbnail` | Public | Small, fast — served from CDN |
| Design detail page hero | `detail` | `preview` | Public | High quality — watermarked (future) |
| Creator's own download | `download` | `original` | Private | Full resolution — no watermark |
| Admin review panel | `detail` | `preview` | Private | Same as detail but auth-gated |

### Access Rules by Asset Type

| Asset Type | Who Can Access | How |
|-----------|---------------|-----|
| `original` | Creator only (authenticated) | Signed URL — server-generated, short-lived |
| `preview` | Anyone (published designs) | Future: public CDN URL or signed URL |
| `thumbnail` | Anyone (published designs) | Future: public CDN URL |

### Processing Pipeline (Phase 6+)

```
Upload original
      │
      ▼
Server inspects file (magic bytes, dimensions, MIME)
      │
      ▼
Store original → designs/{cid}/{did}/original/{filename}
      │
      ▼  [Phase 6+: image processing job]
Generate preview (resize, optional watermark)
      │
      ▼
Generate thumbnail (resize to ~400px width)
      │
      ▼
Store variants → designs/{cid}/{did}/preview/ and thumbnail/
      │
      ▼
Update media_assets records to status='ready'
Update designs.image_url and thumbnail_url
```

---

## 9. Security Model

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Creator accesses another creator's originals | Storage RLS: path segment 2 must be caller's creator_id |
| Creator uploads to another creator's design path | Storage RLS: creator_id in path verified against auth.uid() |
| Client-supplied storage paths | Server always generates paths via buildStoragePath() |
| MIME type spoofing | Server-side validation (Phase 5: MIME check; Phase 6: magic byte check) |
| Path traversal via filename | sanitiseFilename() strips all separators and traversal sequences |
| Oversized file uploads | 50 MB bucket limit + server-side UPLOAD_CONSTRAINTS check |
| Published asset deletion | DELETE RLS only allows 'pending'/'failed' status; 'ready' requires server-role |
| Service role key exposure | Never used in Client Components; restricted to Server Actions / Route Handlers |
| Anonymous upload | No anon INSERT policy on storage.objects for designs-private |
| JWT forgery / bypass | RLS uses auth.uid() from verified JWT — getUser() validates server-side |

### Server-Side Validation Layers

```
Layer 1: Client-side (UX only — not trusted)
  └── File size display, MIME display, dimension preview

Layer 2: Server Action / Route Handler (TRUSTED)
  ├── UPLOAD_CONSTRAINTS check (size, MIME, dimensions)
  ├── Ownership verification: resolveAuthenticatedCreatorId()
  ├── Design ownership: verifyMediaOwnership()
  ├── Storage path generation: buildStoragePath()
  └── Path validation: parseStoragePath()

Layer 3: Storage RLS (ENFORCED IN DATABASE)
  ├── creator_id path segment verified against creators table
  ├── Path prefix must be 'designs'
  └── asset_type segment must be valid

Layer 4: media_assets RLS (ENFORCED IN DATABASE)
  ├── INSERT: creator must own the design
  └── DELETE: only pending/failed assets deletable by owner
```

---

## 10. Future Upload Flow

This is the intended implementation for the actual upload feature (Phase 6+).

```
1. Creator selects a file (browser)
2. Server Action called with: design_id, filename, mime_type, file_size
3. Server verifies ownership: resolveAuthenticatedCreatorId()
4. Server verifies design ownership: verifyMediaOwnership(design_id)
5. Server validates file metadata: validateMediaFile(...)
6. Server generates storage path: buildStoragePath(creator_id, design_id, 'original', filename)
7. Server creates media_assets record: createMediaAssetRecord(...)  [status='pending']
8. Server generates a short-lived upload URL (presigned POST or Supabase upload token)
9. Client uploads directly to Storage using the presigned URL
10. Server confirms upload success (webhook or polling)
11. Server updates media_assets status to 'ready': updateMediaAsset(id, { status: 'ready', ... })
12. Server updates designs.image_url / thumbnail_url from the resolved CDN path
```

### Not Yet Implemented

- Drag & drop upload UI
- Image editor / cropper
- Image processing pipeline (resize, watermark)
- Presigned upload URL generation
- Upload webhook / confirmation
- designs.image_url update from media_assets

---

## 11. Performance Strategy

### Grid / Marketplace Performance

| Concern | Strategy |
|---------|---------|
| Grid loads original images | ❌ Never — always use thumbnails |
| All media metadata sent to browser | ❌ Never — only `thumbnail_url` string sent to UI |
| Client fetches assets for every card | ❌ Never — denormalized `thumbnail_url` on designs row |
| No lazy loading | Future: Next.js `<Image>` with lazy loading default |

### Image Delivery Strategy

```
Marketplace grid  → designs.thumbnail_url  (denormalized, fast, no extra query)
Design detail     → designs.image_url       (denormalized, single query)
Creator dashboard → getOwnDesignMedia()     (server-side, authenticated only)
```

### Future CDN Strategy

When the image processing pipeline is ready:

1. Processed thumbnails/previews stored in a **public bucket** (or CloudFront/Cloudflare)
2. `designs.thumbnail_url` updated to the public CDN URL
3. `designs.image_url` updated to the preview CDN URL
4. Next.js `<Image>` component with `sizes` prop for responsive delivery
5. Original stays in `designs-private` — never CDN-delivered

### Database Query Strategy

- `getDesignMedia()` is called only on design detail pages (not in grids)
- Grid queries use `designs.thumbnail_url` directly — no `media_assets` join
- `getOwnDesignMedia()` is authenticated-only and server-rendered

---

## 12. Rollback Strategy

### Full Rollback Procedure

**Step 1 — Database (run in Supabase SQL Editor)**

```sql
-- Remove media_assets table and all its policies, triggers, indexes
DROP TABLE IF EXISTS public.media_assets;
-- (All policies, triggers, and indexes on media_assets cascade with DROP TABLE)
```

**Step 2 — Storage RLS policies (run in Supabase SQL Editor)**

```sql
DROP POLICY IF EXISTS "storage_creator_upload" ON storage.objects;
DROP POLICY IF EXISTS "storage_creator_read"   ON storage.objects;
DROP POLICY IF EXISTS "storage_creator_delete" ON storage.objects;
```

**Step 3 — Storage bucket (Supabase Dashboard → Storage)**

```
1. Navigate to Storage → designs-private
2. Delete all files (if any exist)
3. Delete the bucket
```

**Or via SQL:**

```sql
-- Only safe if bucket is empty
DELETE FROM storage.objects WHERE bucket_id = 'designs-private';
DELETE FROM storage.buckets  WHERE id        = 'designs-private';
```

### What Rollback Does NOT Touch

- `designs` table — unchanged
- `creators` table — unchanged
- All existing seed data — unchanged
- All existing RLS policies on other tables — unchanged
- All existing migrations — unchanged

### Rollback Risk Level: LOW

Phase 5 is entirely additive. Rolling back removes only the new `media_assets`
table and the `designs-private` bucket. Since no uploads exist yet at this
architecture stage, there is no data to lose.

---

## 13. Remaining Work

### Phase 6 — Image Processing & Upload Implementation

| Task | Description |
|------|-------------|
| Upload Server Action | Server Action that orchestrates the full upload flow |
| Presigned URL generation | Generate Supabase Storage upload tokens server-side |
| Magic byte MIME verification | Verify actual file type from binary header, not claimed MIME |
| Image dimension inspection | Server-side: use Sharp or similar to read actual dimensions |
| Preview generation | Resize original → preview (e.g. 1200px wide, quality 85) |
| Thumbnail generation | Resize original → thumbnail (e.g. 400px wide, quality 70) |
| Public bucket for variants | Create `designs-public` bucket for CDN-delivered processed images |
| Update designs.image_url | After processing, update the denormalized URL on designs row |
| Upload UI Component | Drag-and-drop upload area (creator dashboard) |
| Progress indicator | Client-side upload progress |
| Error & retry handling | Handle failed uploads gracefully in the UI |
| Physical file cleanup job | Async worker to delete storage files for 'deleted' media_assets |

### Files Created in Phase 5

| File | Purpose |
|------|---------|
| `types/media.ts` | Full media domain type definitions |
| `services/media.service.ts` | Server-side media operations |
| `supabase/migrations/20260827000000_media_storage_foundation.sql` | media_assets table + bucket + RLS |
| `docs/storage-audit.md` | Pre-implementation storage audit |
| `docs/media-architecture.md` | This document |

### Files Modified in Phase 5

| File | Change |
|------|--------|
| `types/index.ts` | Added media type exports |
| `services/index.ts` | Added media service exports |
