# CDN Delivery & Public Media Layer — Phase 11

**Project:** Morrow Marketplace  
**Phase:** 11 — CDN Delivery & Public Media Layer  
**Migration:** `20260831000000_cdn_delivery_phase11.sql`  
**Status:** Implemented

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Storage Strategy](#2-storage-strategy)
3. [Database Changes](#3-database-changes)
4. [Security Model](#4-security-model)
5. [Service Layer](#5-service-layer)
6. [Worker Integration](#6-worker-integration)
7. [Marketplace Integration](#7-marketplace-integration)
8. [Performance](#8-performance)
9. [Migration Explanation](#9-migration-explanation)
10. [Rollback Plan](#10-rollback-plan)

---

## 1. Architecture Overview

Phase 11 adds a **public CDN delivery layer** on top of the existing private storage pipeline. All previous phases remain unchanged.

```
Creator Upload
      │
      ▼
designs-private (Phase 5)
  designs/{creator_id}/{design_id}/original/{filename}
      │
      ▼
Phase 10 Optimization Worker (WASM JPEG/WebP encoding)
      │
      ├─► designs-private (unchanged — preview & thumbnail also stay here)
      │     designs/{creator_id}/{design_id}/preview/{filename}
      │     designs/{creator_id}/{design_id}/thumbnail/{filename}
      │
      └─► designs-public  ◄── NEW (Phase 11)
            preview/{creator_id}/{design_id}/{filename}
            thumbnail/{creator_id}/{design_id}/{filename}
                  │
                  ▼
      CDN URL (public, permanent, no signed URL required)
                  │
                  ▼
      Marketplace (anonymous users, grid cards, detail pages)
```

### Key Principles

| Rule | Implementation |
|------|----------------|
| Originals ALWAYS private | Never uploaded to `designs-public`; `buildCdnPath()` throws if `asset_type === 'original'` |
| No direct upload to public bucket | No client INSERT policy on `designs-public`; only service-role worker can write |
| Published designs only | `isDesignPublished()` checks `status='published'` AND `is_public=true` before serving CDN URL |
| CDN publish is non-fatal | If `publishToCdn()` fails, the asset remains available via signed URL fallback |
| Immutable asset paths | `Cache-Control: public, max-age=31536000, immutable` on every CDN upload |

---

## 2. Storage Strategy

### Bucket Inventory

| Bucket | `public` | Contains | Who writes |
|--------|----------|----------|------------|
| `designs-private` | false | originals, previews, thumbnails (Phase 5–10) | Creator upload + service worker |
| `designs-public` | **true** | previews, thumbnails **only** | Service worker only (Phase 11) |

### Path Conventions

**designs-private** (existing, unchanged):
```
designs/{creator_id}/{design_id}/original/{filename}
designs/{creator_id}/{design_id}/preview/{filename_preview.jpg}
designs/{creator_id}/{design_id}/thumbnail/{filename_thumb.jpg}
```

**designs-public** (new, Phase 11):
```
preview/{creator_id}/{design_id}/{filename_preview.jpg}
thumbnail/{creator_id}/{design_id}/{filename_thumb.jpg}
```

### CDN URL Format

```
{SUPABASE_URL}/storage/v1/object/public/designs-public/{cdn_path}
```

Example:
```
https://xxx.supabase.co/storage/v1/object/public/designs-public/thumbnail/abc-0001/def-0002/image_thumb.jpg
```

This URL is:
- **Permanent** — the path is deterministic from the design's creator_id and design_id.
- **Immutable** — a 1-year `Cache-Control` header is set at upload time.
- **Anonymous-readable** — bucket `public=true` enables CDN-level read without any signed URL or auth token.

---

## 3. Database Changes

All changes are **additive only**. No existing rows, columns, or policies were modified.

### New columns on `media_assets`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `public_url` | `text` | YES | Permanent CDN URL in `designs-public`. NULL until worker publishes to CDN. |
| `cdn_path` | `text` | YES | Path within `designs-public` bucket. Format: `{type}/{creator}/{design}/{file}`. |
| `published_at` | `timestamptz` | YES | Timestamp when asset was first published to CDN. |

### New indexes

| Index | Expression | Purpose |
|-------|-----------|---------|
| `idx_media_assets_public_url` | `(design_id, asset_type) WHERE public_url IS NOT NULL AND status='ready'` | Fast marketplace CDN URL lookup |
| `idx_media_assets_cdn_path` | `(cdn_path) WHERE cdn_path IS NOT NULL` | Worker deduplication check |
| `idx_media_assets_published` | `(published_at DESC) WHERE published_at IS NOT NULL` | Admin reporting, cache invalidation |

### Timestamp Semantics

| Column | Set when |
|--------|---------|
| `created_at` | Row inserted (Phase 5) |
| `updated_at` | Any column changed (Phase 5 trigger) |
| `optimized_at` | WASM processing completed (Phase 10) |
| `published_at` | File copied to `designs-public` CDN bucket (Phase 11) |

### Zero-Impact Guarantee

- All three new columns default to `NULL`.
- No existing queries reference these columns.
- All seed data (40 designs, 8 creators) is completely unmodified.
- `SELECT *` on `media_assets` from existing code gains three extra null columns — invisible to consumers that do not reference them.

---

## 4. Security Model

### Access Matrix

| Actor | designs-private originals | designs-private preview/thumbnail | designs-public preview/thumbnail |
|-------|--------------------------|----------------------------------|----------------------------------|
| Anonymous user | ✗ No policy = DENY | ✗ No policy = DENY | ✓ Bucket public=true + `storage_public_read` policy |
| Authenticated user (not owner) | ✗ DENY | ✗ DENY | ✓ Read-only CDN |
| Owning creator | ✓ Signed URL via `getCreatorOriginalUrl()` | ✓ Signed URL via `getCreatorPreviewUrl()` | ✓ Read-only CDN |
| Creator A accessing Creator B | ✗ Blocked by RLS + ownership check | ✗ Blocked by RLS | ✓ Only if design is published (same as public) |
| Service worker (service role) | ✓ Reads originals for processing | ✓ Writes optimized versions | ✓ Writes CDN copies |

### RLS Policies

**designs-public bucket — `storage_public_read`:**
- `FOR SELECT TO anon, authenticated`
- `USING (bucket_id = 'designs-public' AND (storage.foldername(name))[1] IN ('thumbnail', 'preview'))`
- Allows reading only the canonical `thumbnail/` and `preview/` subtrees.
- No path outside these roots can be served.

**designs-public bucket — INSERT:**
- No INSERT policy for `anon` or `authenticated` roles.
- INSERT is denied by default (no policy = deny).
- The worker uses the `service_role` key which bypasses RLS intentionally.

**designs-public bucket — DELETE:**
- No DELETE policy for any role.
- Files are managed exclusively by the service-role worker.

**`media_assets` table policies (unchanged from Phase 5–10):**
- `read_published_media_assets`: anon + authenticated can SELECT ready preview/thumbnail for published designs.
- `read_own_media_assets`: creators see all their own assets at any status.
- `insert_own_media_assets`, `update_own_media_assets`, `delete_own_media_assets`: creator-scoped mutations.

### Application-Level Guards

`getPublicThumbnailUrl()` and `getPublicPreviewUrl()` always call `isDesignPublished()` first:
```typescript
const published = await isDesignPublished(designId);
if (!published) return { success: false, reason: 'design_not_published' };
```

Even if an anonymous user somehow guessed a CDN path, unpublished assets would not have a `public_url` in the database, so the service layer never returns URLs for them.

---

## 5. Service Layer

**File:** `services/media-delivery.service.ts`

### Function Reference

#### `getPublicThumbnailUrl(designId)`
```typescript
async function getPublicThumbnailUrl(designId: string): Promise<MediaDeliveryResult>
```
- Validates `designs.status = 'published'` and `designs.is_public = true`.
- Returns the permanent CDN URL from `media_assets.public_url`.
- Returns `{ success: false, reason: 'thumbnail_not_published_to_cdn' }` if the worker has not yet promoted this asset.

#### `getPublicPreviewUrl(designId)`
```typescript
async function getPublicPreviewUrl(designId: string): Promise<MediaDeliveryResult>
```
- Same pattern as `getPublicThumbnailUrl` but for the `preview` asset type.

#### `getCreatorOriginalUrl(designId)`
```typescript
async function getCreatorOriginalUrl(designId: string): Promise<MediaDeliveryResult>
```
- Requires authentication. Resolves creator_id from session.
- Verifies `media_assets.creator_id === resolved creator_id` after DB fetch.
- Returns a 1-hour signed URL from `designs-private`.
- Original files NEVER go through the public CDN.

#### `getDesignPublicMedia(designId)`
```typescript
async function getDesignPublicMedia(designId: string): Promise<DesignPublicMedia>
```
- Single DB round-trip for both thumbnail and preview CDN URLs.
- Returns `null` URLs for assets not yet on CDN — caller must use fallback.
- Does not require authentication. Intentionally public.

#### `batchGetDesignPublicMedia(designIds)`
```typescript
async function batchGetDesignPublicMedia(designIds: string[]): Promise<Map<string, DesignPublicMedia>>
```
- Single DB query for all supplied design IDs.
- Avoids N+1 queries on Home/Discover grid pages.
- Returns a `Map<designId, DesignPublicMedia>` — every input ID has an entry.

### Integration with Existing Services

| Existing service | Phase 11 relationship |
|-----------------|----------------------|
| `media-url.service.ts` | Unchanged. Still used for creator signed URLs. |
| `design-media.service.ts` | Unchanged. `thumbnailSignedUrl` still works as fallback. |
| `media.service.ts` | Unchanged. Core CRUD and path generation untouched. |
| `media-processing.service.ts` | Unchanged. Client-side processing helpers untouched. |
| `media-queue.service.ts` | Unchanged. Job queue unmodified. |

---

## 6. Worker Integration

**File:** `supabase/functions/media-worker/index.ts`  
**Config:** `supabase/functions/media-worker/media-processing.config.ts`

### Changes to Worker

Two new worker functions were added:

#### `publishToCdn(supabase, data, mimeType, cdnPath)`
- Uploads the optimized bytes to `designs-public` with `Cache-Control: 31536000`.
- Returns the permanent CDN URL on success, `null` on failure.
- Failure is non-fatal — the asset remains usable via signed URL from `designs-private`.

#### `buildCdnPath(privatePath)`
- Converts `designs/{creator_id}/{design_id}/{asset_type}/{filename}` → `{asset_type}/{creator_id}/{design_id}/{filename}`.
- Throws if `asset_type === 'original'` — originals must never be published to CDN.

### Extended `runPreviewStep` and `runThumbnailStep`

Each step now:
1. Uploads to `designs-private` (unchanged Phase 10 behavior).
2. Calls `publishToCdn()` to copy to `designs-public`.
3. Writes `cdn_path`, `public_url`, and `published_at` to `media_assets`.

If step 2 fails, steps 1 and 3 still succeed with `NULL` CDN fields — the pipeline does not fail.

### Config Addition

```typescript
// supabase/functions/media-worker/media-processing.config.ts
export const PUBLIC_BUCKET = 'designs-public' as const;
```

---

## 7. Marketplace Integration

No existing UI components were modified. The CDN delivery layer is a **drop-in replacement** for signed URL generation in marketplace contexts.

### Recommended Integration Pattern

**Before Phase 11** (signed URL per card):
```typescript
// Server Component — N signed URL requests for N cards
const mediaResult = await getMarketplaceThumbnailUrl(designId);
const thumbnailUrl = mediaResult?.success ? mediaResult.signedUrl : design.thumbnail_url;
```

**After Phase 11** (single batch CDN query):
```typescript
// Server Component — 1 DB query for all visible cards
const cdnMedia = await batchGetDesignPublicMedia(designIds);
const media = cdnMedia.get(design.id);
const thumbnailUrl = media?.thumbnailCdnUrl ?? design.thumbnail_url;
```

### Pages Ready for Integration

| Page | Service to use | Fallback |
|------|---------------|---------|
| Home (`/[locale]`) | `batchGetDesignPublicMedia` | `design.thumbnail_url` (Pexels seed URL) |
| Discover (`/[locale]/discover`) | `batchGetDesignPublicMedia` | `design.thumbnail_url` |
| Artist Profile (`/[locale]/artists/[handle]`) | `batchGetDesignPublicMedia` | `design.thumbnail_url` |
| Design Detail (`/[locale]/designs/[slug]`) | `getDesignPublicMedia` | `design.image_url` |

> **Phase 11 does NOT modify these pages.** The integration table above is a guide for future work. The existing `image_url` and `thumbnail_url` columns continue to serve seed data unmodified.

---

## 8. Performance

### CDN Cache Headers

Every file uploaded to `designs-public` receives:
```
Cache-Control: public, max-age=31536000, immutable
```
This instructs CDN edges (Cloudflare/Fastly) and browsers to cache for 1 year without revalidation.

### Immutable Asset Paths

CDN paths incorporate both `creator_id` and `design_id`:
```
thumbnail/{creator_id}/{design_id}/{filename}
```
Because these are UUIDs, paths are globally unique and never collide. When an image is re-optimized (e.g. after the creator re-uploads), the filename changes (`_thumb.jpg` suffix derived from the original filename), so the new file gets a fresh cache entry automatically.

### Query Performance

- `batchGetDesignPublicMedia(n)` → 2 DB queries (1 publication check + 1 asset query) regardless of `n`.
- The `idx_media_assets_public_url` partial index covers the common `WHERE public_url IS NOT NULL AND status='ready'` pattern.

### Fallback Strategy

```
CDN URL (public_url in media_assets)
    │  NULL or CDN failure
    ▼
Signed URL (getMarketplaceThumbnailUrl — designs-private)
    │  Asset not ready or not found
    ▼
designs.thumbnail_url  (Pexels seed URL or previously uploaded URL)
    │  NULL
    ▼
Static placeholder image
```

---

## 9. Migration Explanation

### What the Migration Does

1. **Creates `designs-public` bucket** — public, 10 MB limit, JPEG/WebP/PNG types.
2. **Adds `storage_public_read` RLS policy** — allows `anon` + `authenticated` to SELECT from `thumbnail/` and `preview/` paths only.
3. **Adds `public_url` column** — nullable text; the permanent CDN URL written by the worker.
4. **Adds `cdn_path` column** — nullable text; the path inside `designs-public`.
5. **Adds `published_at` column** — nullable timestamptz; when the file was CDN-published.
6. **Creates 3 new partial indexes** — for CDN URL lookup, cdn_path deduplication, and published-at reporting.

### What the Migration Does NOT Do

- Does NOT modify any existing column, table, or row.
- Does NOT remove any existing RLS policy.
- Does NOT touch `designs-private` in any way.
- Does NOT modify any seed data.
- Does NOT change any existing trigger, function, or constraint.

---

## 10. Rollback Plan

### Step 1 — Remove new DB columns and indexes

```sql
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS public_url;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS cdn_path;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS published_at;

DROP INDEX IF EXISTS idx_media_assets_public_url;
DROP INDEX IF EXISTS idx_media_assets_cdn_path;
DROP INDEX IF EXISTS idx_media_assets_published;
```

### Step 2 — Remove Storage policies

Run in Supabase Dashboard → Storage → Policies, or via SQL:

```sql
DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
```

### Step 3 — Remove the public bucket

> Only safe if the bucket is empty (no CDN files were written yet), or after verifying removal is acceptable.

```sql
-- Via Dashboard → Storage → delete bucket 'designs-public'
-- Or via management API
DELETE FROM storage.buckets WHERE id = 'designs-public';
```

### Step 4 — Revert worker and service layer

- Revert `supabase/functions/media-worker/index.ts` to Phase 10 version (remove `publishToCdn`, `buildCdnPath`, and CDN field writes in `runPreviewStep`/`runThumbnailStep`).
- Revert `supabase/functions/media-worker/media-processing.config.ts` (remove `PUBLIC_BUCKET`).
- Delete `services/media-delivery.service.ts`.
- Remove Phase 11 exports from `services/index.ts`.
- Revert Phase 11 additions to `types/media.ts`.

### Rollback Safety

- All rollback steps are non-destructive to existing data.
- `designs-private` is never affected.
- Existing `media_assets` rows lose only the three nullable CDN columns — no data loss on existing content.
- All marketplace pages continue to function with Pexels seed URLs and signed-URL fallback.

---

*Phase 11 — Morrow Marketplace — Production Media Infrastructure Expansion*
