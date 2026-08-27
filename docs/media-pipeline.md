# Media Pipeline — Morrow Marketplace
## Phase 8 Documentation

---

## Table of Contents

1. [Media Lifecycle](#1-media-lifecycle)
2. [Storage Architecture](#2-storage-architecture)
3. [URL Security](#3-url-security)
4. [Processing Strategy](#4-processing-strategy)
5. [Future Scaling Plan](#5-future-scaling-plan)
6. [Security Audit](#6-security-audit)
7. [API Reference](#7-api-reference)

---

## 1. Media Lifecycle

### Asset Status Flow

Every file uploaded to the platform follows a deterministic lifecycle:

```
pending
  ↓  [upload begins]
processing
  ↓  [upload + metadata extraction complete]
ready
  ↓  [design archived or creator deletes]
deleted
  ↓  [cleanup job removes physical file]
```

If any step fails:
```
pending / processing
  ↓  [upload error or processing failure]
failed
  ↓  [creator retries or deletes]
```

### Asset Types

Each design has three independent asset slots:

| Asset Type  | Purpose                        | Access       | Max Dimension |
|-------------|--------------------------------|--------------|---------------|
| `original`  | Full-resolution creator upload | Owner only   | 10 000 px     |
| `preview`   | Creator review / detail page   | Owner + admin | 1 200 px (target) |
| `thumbnail` | Marketplace grid cards         | Public-ready  | 400 px (target) |

### Lifecycle Events Triggered by Design Status

| Design Event             | Media Impact                              |
|--------------------------|-------------------------------------------|
| Upload starts            | `original` record created, status=pending |
| Upload completes         | `original` status=processing              |
| Processing completes     | all three assets status=ready             |
| Processing fails         | affected asset(s) status=failed           |
| Design archived          | assets logically deleted (status=deleted) |
| Creator re-uploads       | old asset replaced (upsert), new record   |
| Design hard-deleted      | cascade DELETE removes all asset records  |

### New in Phase 8

- `checksum` column added: SHA-256 hex digest for deduplication
- `processing_log` column added: JSONB array of timestamped events
- Preview + thumbnail assets are now created automatically via `processDesignMedia()`
- Full metadata extraction (dimensions, file size, MIME type, checksum)

---

## 2. Storage Architecture

### Bucket Strategy

```
designs-private (Supabase Storage)
  └── designs/
       └── {creator_id}/
            └── {design_id}/
                 ├── original/   ← full-res upload
                 ├── preview/    ← resized for review
                 └── thumbnail/  ← small for cards
```

### Path Convention

```
designs/{creator_id}/{design_id}/{asset_type}/{filename}
```

**Properties:**
- `creator_id` — `creators.id` (standalone UUID, not `auth.users.id`)
- `design_id`  — `designs.id`
- `asset_type` — `original` | `preview` | `thumbnail`
- `filename`   — sanitised original filename (lowercase, alphanumeric + `._-`)

**Examples:**
```
designs/abc-uuid/def-uuid/original/pattern.png
designs/abc-uuid/def-uuid/preview/pattern_preview.jpg
designs/abc-uuid/def-uuid/thumbnail/pattern_thumb.jpg
```

### Bucket Configuration

| Property          | Value                                              |
|-------------------|----------------------------------------------------|
| Bucket ID         | `designs-private`                                  |
| Public            | `false` (no direct URL access)                     |
| Max file size     | 50 MB per object                                   |
| Allowed MIME types| image/png, image/jpeg, image/webp, image/tiff, image/svg+xml |

### Database Model

```
media_assets
  id            UUID PK
  design_id     UUID FK → designs.id  (CASCADE DELETE)
  creator_id    UUID FK → creators.id (CASCADE DELETE)
  storage_path  TEXT NOT NULL
  storage_bucket TEXT DEFAULT 'designs-private'
  asset_type    TEXT CHECK ('original','preview','thumbnail')
  mime_type     TEXT
  file_size     BIGINT
  width         INTEGER
  height        INTEGER
  status        TEXT CHECK ('pending','processing','ready','failed','deleted')
  checksum      TEXT CHECK (~'^[0-9a-f]{64}$')   ← Phase 8
  processing_log JSONB                            ← Phase 8
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
```

### Constraints

- **Partial unique index** `idx_media_assets_active_type`: only one non-deleted
  asset per type per design. Prevents duplicate active originals/previews/thumbnails.
- **Cascade deletes**: deleting a design removes all its media_assets records.

---

## 3. URL Security

### Signed URL Architecture

All private files are accessed via signed URLs generated server-side.
The client never receives:
- Storage paths
- Bucket names
- Creator IDs
- Any raw Supabase Storage reference

```
Client
  ↓  request (authenticated)
Server (Route Handler / Server Component)
  ↓  ownership verified
  ↓  storage path resolved from DB
  ↓  signed URL generated (server → Supabase Storage API)
Client
  ↑  receives opaque signed URL (time-limited)
```

### Expiry Durations

| Asset Type  | Expiry     | Rationale                                |
|-------------|------------|------------------------------------------|
| `original`  | 1 hour     | Maximum protection — private creator file |
| `preview`   | 24 hours   | Balance between UX and security          |
| `thumbnail` | 7 days     | Optimised for caching and performance    |

### URL Service Functions

```typescript
// Owner-only access to any asset
getSignedMediaUrl(assetId, assetType)

// Creator reviews their own design
getCreatorPreviewUrl(designId)

// Marketplace card display
getMarketplaceThumbnailUrl(designId)

// All three URLs for the design editor
getDesignMediaUrls(designId)

// Original file (owner only)
getOriginalFileUrl(designId)

// Check if a URL is still valid
isSignedUrlValid(expiresAt, bufferMs?)
```

### Access Matrix

| User              | original | preview | thumbnail |
|-------------------|----------|---------|-----------|
| Owning creator    | ✓ (1h)  | ✓ (24h) | ✓ (7d)   |
| Other creators    | ✗        | ✗        | ✓* (7d)  |
| Anonymous users   | ✗        | ✗        | ✗ Phase 8 |

_* Phase 9: thumbnails will be publicly accessible via CDN._

---

## 4. Processing Strategy

### Phase 8 Pipeline

On a successful original upload, `processDesignMedia()` is called:

```
1. extractImageMetadata()
   → width, height, file_size, mime_type, checksum (SHA-256)
   → updates original asset record

2. generatePreview()
   → creates preview asset record (status=processing)
   → uploads file to designs/{creator_id}/{design_id}/preview/
   → updates record to ready
   → Phase 8: full-resolution copy (resize pending Phase 9 worker)

3. generateThumbnail()
   → creates thumbnail asset record (status=processing)
   → uploads file to designs/{creator_id}/{design_id}/thumbnail/
   → updates record to ready
   → Phase 8: full-resolution copy (resize pending Phase 9 worker)
```

### Metadata Extraction

The `extractImageMetadata()` function:
- Computes SHA-256 checksum via Web Crypto API
- Parses pixel dimensions from image headers (no native codec required):
  - PNG: reads IHDR chunk at bytes 16–23
  - JPEG: scans for SOF0/SOF2 markers
  - WebP: reads VP8L bitstream header

### Image Processing (Current Limitations)

**Phase 8 limitation**: actual image resizing is not yet implemented.
The system uploads the original buffer as both preview and thumbnail.
Actual resizing to 1200px / 400px will be implemented by a background worker in Phase 9.

**Deduplication**: `findDuplicateByChecksum()` checks if an identical file
already exists for the same design before processing.

---

## 5. Future Scaling Plan

### Phase 9: Background Worker

Replace synchronous processing in the upload Route Handler with a queue:

```
Upload Route Handler
  ↓  [stores original, creates job record]
Job Queue (pg_cron / Supabase Edge Function / Redis BullMQ)
  ↓  [worker picks up job]
Background Worker
  ↓  processDesignMedia() with sharp/jimp
  ↓  → actual resize to PREVIEW_MAX_PX (1200) and THUMBNAIL_MAX_PX (400)
  ↓  → JPEG re-encoding at target quality
  ↓  → storage upload of processed files
  ↓  → media_assets records updated to 'ready'
Creator UI (polling / websocket)
  ↑  status updates via Supabase Realtime or SSE
```

The current `processDesignMedia()` signature is already compatible with a
worker model — it accepts the same parameters a job payload would carry.

### Phase 10: CDN Delivery

Move thumbnails to a public bucket and serve via CDN:

```
designs-private (originals + previews — remains private)
designs-public  (thumbnails — CDN-accessible, future bucket)
  └── CDN origin: storage.morrow.market
  └── Cache-Control: public, max-age=604800
```

This eliminates the need for signed URLs for marketplace grid cards.
The `getMarketplaceThumbnailUrl()` function will be updated to return
a direct CDN URL instead of a signed Storage URL.

### Phase 11: Watermarking

For design detail page previews, add a server-side watermark:

```
original → Background Worker → sharp overlay with "morrow.market" →
  → preview with watermark stored in designs-private
  → signed URL generated per session (prevents hotlinking)
```

### Phase 12: Image Optimization

Serve WebP and AVIF variants based on Accept header:

```
CDN edge function → format negotiation → serve best available format
/designs/{id}/thumbnail.webp  (WebP — 30% smaller than JPEG)
/designs/{id}/thumbnail.avif  (AVIF — 50% smaller than JPEG)
```

### Performance Architecture Principles

| Principle               | Implementation                                   |
|-------------------------|--------------------------------------------------|
| No browser processing   | All image ops in server/worker context           |
| No original in browser  | Only signed thumbnails/previews delivered        |
| No large images to grid | Thumbnails max 400px (Phase 9)                   |
| No N+1 URL queries      | `batchGetPublicDesignMedia()` batch fetches       |
| No polling in components | Realtime subscriptions on media_assets (Phase 9) |
| No global image lists   | Per-card lazy loading with signed URLs           |

---

## 6. Security Audit

### Threat Model

| Threat                        | Mitigation                                              |
|-------------------------------|---------------------------------------------------------|
| Creator A reads Creator B's files | Storage RLS: path creator_id verified against auth.uid() |
| Client-supplied storage path   | Paths always built server-side via `buildStoragePath()` |
| Path traversal in filename    | `sanitiseFilename()` replaces unsafe chars with `_`    |
| Unsigned URL leakage          | All private URLs expire (1h / 24h / 7d)               |
| Hotlinking previews           | Signed URLs are single-use and time-limited            |
| Bypassing processing status   | RLS on media_assets enforces status checks             |
| Cross-creator collection      | Service + RLS double-check ownership before insert     |
| Fake MIME type upload         | Server-side magic byte verification (Phase 9 full impl)|
| Oversized upload              | 50 MB server-side limit + bucket-level enforcement     |

### Ownership Chain

```
auth.uid() (Supabase auth token)
  ↓  [creators.user_id = auth.uid()]
creators.id (standalone creator UUID)
  ↓  [designs.creator_id = creators.id]
designs.id
  ↓  [media_assets.creator_id = creators.id]
media_assets
  ↓  [storage path: designs/{creator_id}/...]
storage.objects
```

**Critical rule**: `creator_id` in media_assets is `creators.id` (NOT `auth.users.id`).
Ownership verification always goes through `auth_user_owns_creator(creator_id)`.

---

## 7. API Reference

### Services Created in Phase 8

#### `services/media-processing.service.ts`

| Function                        | Description                                   |
|---------------------------------|-----------------------------------------------|
| `processDesignMedia()`          | Full pipeline orchestrator (extract+preview+thumb) |
| `generatePreview()`             | Create preview asset from original buffer     |
| `generateThumbnail()`           | Create thumbnail asset from original buffer   |
| `extractImageMetadata()`        | Extract width/height/checksum/mime from buffer |
| `findDuplicateByChecksum()`     | Deduplication check by SHA-256 checksum       |
| `getDesignMediaProcessingStatus()` | Get all asset statuses for a design         |
| `scaleDimensions()`             | Proportional dimension scaling utility        |

#### `services/media-url.service.ts`

| Function                        | Description                                   |
|---------------------------------|-----------------------------------------------|
| `getSignedMediaUrl()`           | Signed URL for any asset (owner only)         |
| `getCreatorPreviewUrl()`        | Signed preview URL (creator's own design)     |
| `getMarketplaceThumbnailUrl()`  | Signed thumbnail URL (public-ready)           |
| `getDesignMediaUrls()`          | All three URLs for a design (parallel)        |
| `getOriginalFileUrl()`          | Signed original URL (owner only, 1h)          |
| `isSignedUrlValid()`            | Check URL expiry with buffer                  |

#### `services/design-media.service.ts`

| Function                        | Description                                   |
|---------------------------------|-----------------------------------------------|
| `getPublicDesignMedia()`        | Media availability for a published design     |
| `batchGetPublicDesignMedia()`   | Batch media availability (for grid pages)     |
| `getCreatorDesignMediaStatus()` | Enriched media status for creator (all types) |
| `isDesignReadyForReview()`      | Check if design has required media for review |

#### `services/design-metadata.service.ts`

| Function                  | Description                                 |
|---------------------------|---------------------------------------------|
| `getDesignCategories()`   | Get categories attached to a design         |
| `addDesignCategory()`     | Add one category to a design                |
| `removeDesignCategory()`  | Remove one category from a design           |
| `setDesignCategories()`   | Atomic replace of all design categories     |
| `getDesignTags()`         | Get tags attached to a design               |
| `addDesignTag()`          | Add one tag to a design                     |
| `removeDesignTag()`       | Remove one tag from a design                |
| `setDesignTags()`         | Atomic replace of all design tags           |
| `setDesignMetadata()`     | Update categories + tags in one call        |

#### `services/collection.service.ts`

| Function                          | Description                               |
|-----------------------------------|-------------------------------------------|
| `getMyCollections()`              | Creator's own collections (all statuses)  |
| `getCollectionWithItems()`        | Collection + its design items             |
| `createCollection()`             | Create a new draft collection             |
| `addDesignToCollection()`        | Add design to collection (owner-only)     |
| `removeDesignFromCollection()`   | Remove design from collection             |
| `getCollectionsContainingDesign()` | Which collections contain a design       |

### Components Created in Phase 8

#### `components/media/MediaStatus.tsx`

| Component            | Description                                  |
|----------------------|----------------------------------------------|
| `MediaStatus`        | Status badge for any media asset lifecycle state |
| `MediaStatusRow`     | Asset type + status in a compact row         |
| `MediaStatusStack`   | All three asset statuses in a vertical stack |

#### `components/media/Thumbnail.tsx`

| Component           | Description                                   |
|---------------------|-----------------------------------------------|
| `Thumbnail`         | Smart grid card image with source cascade     |
| `ThumbnailCompact`  | Small square thumbnail for list rows          |

#### `components/media/MediaPreview.tsx`

| Component              | Description                                |
|------------------------|--------------------------------------------|
| `MediaPreview`         | Full design preview with replace overlay   |
| `MediaPreviewCompact`  | Small preview for list rows                |

### Database Migration

**File**: `supabase/migrations/20260828000000_media_pipeline_phase8.sql`

**Changes (additive only)**:
- `media_assets.checksum TEXT` — SHA-256 hex digest, nullable
- `media_assets.processing_log JSONB` — processing event log, nullable
- `idx_media_assets_checksum` — partial index for deduplication queries
- `idx_media_assets_processing` — partial index for processing status queries

**Rollback**:
```sql
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS checksum;
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS processing_log;
DROP INDEX IF EXISTS idx_media_assets_checksum;
DROP INDEX IF EXISTS idx_media_assets_processing;
```

---

*Phase 8 — Professional Media Pipeline & Design Asset Delivery*
*Morrow Marketplace*
