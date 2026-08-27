# Design Upload Architecture — Phase 7

## Overview

The Design Creation & Upload System allows approved creators on the Morrow
Marketplace to draft designs, upload design images, edit metadata, and
submit for admin review. It is built entirely on top of the existing
Phase 4 (design lifecycle) and Phase 5 (media storage) infrastructure.

---

## 1. Upload Architecture

```
Creator Browser
    │
    ├── 1. Fill title (required)
    │
    ├── 2. Select image (drag-and-drop or file picker)
    │       ↓ client-side pre-validation (type, size)
    │
    ├── 3. POST /api/creator/designs          ← create draft
    │       ↓ server resolves creator_id from session
    │       ↓ RLS: insert_own_designs_v4
    │       → returns { id, slug, status: 'draft' }
    │
    ├── 4. POST /api/creator/designs/[id]/upload
    │       ↓ server-side validation (MIME, size, filename)
    │       ↓ createMediaAssetRecord() → status: 'pending'
    │       ↓ Supabase Storage upload → designs-private bucket
    │       ↓ updateMediaAsset() → status: 'ready'
    │       → returns { assetId, status, mimeType, fileSizeBytes }
    │
    ├── 5. PUT /api/creator/designs/[id]       ← save edits
    │       ↓ RLS: update_own_designs_v4
    │
    └── 6. POST /api/creator/designs/[id]/submit  ← submit for review
            ↓ DB function: submit_design_for_review() [SECURITY DEFINER]
            ↓ status: draft → pending_review
```

---

## 2. Storage Flow

### Bucket

`designs-private` — private, no public URL access.

| Property         | Value                            |
|------------------|----------------------------------|
| Bucket ID        | `designs-private`                |
| Public           | `false`                          |
| Max file size    | 50 MB                            |
| Allowed MIME     | PNG, JPEG, WEBP, SVG, TIFF       |

> For Phase 7 creator uploads, only PNG, JPEG, WEBP are accepted by the
> Route Handler. SVG and TIFF are reserved for future admin/batch ingestion.

### Path Convention

```
designs/{creator_id}/{design_id}/{asset_type}/{filename}
```

| Segment      | Source                                  |
|--------------|-----------------------------------------|
| `designs`    | Hard-coded prefix                       |
| `creator_id` | `creators.id` — resolved from session  |
| `design_id`  | `designs.id` — created by the system   |
| `asset_type` | `original` (Phase 7); future: `preview`, `thumbnail` |
| `filename`   | Sanitised by `sanitiseFilename()`       |

**Paths are always generated server-side.** The client never supplies any
path component.

### File Access

Files in `designs-private` are never served via a public URL. Future access
patterns:

- **Creator preview**: Generate a signed URL server-side (short TTL, ~1 hour)
- **Admin review**: Generate a signed URL with admin role
- **Buyer download** (future): After license verification, generate a one-time signed URL

---

## 3. Security Model

### Ownership Chain

```
auth.users (auth.uid())
    ↓  [creators.user_id = auth.uid()]
creators
    ↓  [designs.creator_id = creators.id]
designs
    ↓  [media_assets.design_id = designs.id]
media_assets
    ↓  [storage path: designs/{creator_id}/{design_id}/...]
Storage objects
```

### RLS Policies Protecting Design Operations

| Operation      | Policy                    | Enforces                                          |
|----------------|---------------------------|---------------------------------------------------|
| Read own       | `read_own_designs`        | creator_id → creators.user_id = auth.uid()       |
| Insert (draft) | `insert_own_designs_v4`   | status='draft', is_public=false, ownership        |
| Update         | `update_own_designs_v4`   | ownership; status NOT IN ('approved','published') |
| Delete         | `delete_own_designs_v4`   | ownership; status IN ('draft','pending_review','archived') |

### RLS Policies Protecting Media Assets

| Operation | Policy                       | Enforces                                         |
|-----------|------------------------------|--------------------------------------------------|
| Read own  | `read_own_media_assets`      | creator_id → creators.user_id = auth.uid()      |
| Insert    | `insert_own_media_assets`    | ownership + design.creator_id consistency        |
| Update    | `update_own_media_assets`    | ownership; immutable path/creator/design fields  |
| Delete    | `delete_own_media_assets`    | ownership; only 'pending' or 'failed' status     |

### Storage RLS Policies

| Operation | Policy                  | Enforces                                            |
|-----------|-------------------------|-----------------------------------------------------|
| Upload    | `storage_creator_upload`| creator owns path prefix; status='approved'; asset_type valid |
| Read      | `storage_creator_read`  | creator owns path prefix                            |
| Delete    | `storage_creator_delete`| creator owns path; asset not in 'ready' status      |

### Status Escalation Protection

Creators **cannot** self-publish. The status flow is:

```
draft → pending_review  (creator action: submit_design_for_review)
pending_review → approved → published  (admin-only: SECURITY DEFINER functions)
```

RLS `update_own_designs_v4` explicitly blocks status IN ('approved', 'published')
from any creator-owned UPDATE. The `submit_design_for_review` SECURITY DEFINER
function enforces draft → pending_review and nothing else.

### Cross-Creator Isolation

- Creator A **cannot** access Creator B's designs (RLS subquery)
- Creator A **cannot** access Creator B's storage paths (Storage RLS path prefix check)
- Creator A **cannot** create media_asset records for Creator B's designs

---

## 4. Media Lifecycle

```
File selected by creator
    ↓
[Client] Pre-validation: MIME, size
    ↓
POST /api/creator/designs/[id]/upload
    ↓
[Server] Re-validation: MIME, size, filename safety
    ↓
createMediaAssetRecord() → status = 'pending'
    ↓
Supabase Storage upload (upsert=true for re-uploads)
    │
    ├── [Success] updateMediaAsset() → status = 'ready'
    │
    └── [Failure] updateMediaAsset() → status = 'failed'
                  (audit trail preserved; creator can retry)
```

**Partial unique index**: `idx_media_assets_active_type` ensures a design
can have at most one non-deleted asset per type at any time. Re-uploading
a new original marks the old one 'deleted' (soft-delete) before inserting
the new record.

---

## 5. Future Image Processing Points

The architecture is designed with future image processing in mind.
These integration points are already prepared in the schema:

### Point A — Post-upload Processing Trigger
```
POST /api/creator/designs/[id]/upload
    ↓  (after status → 'ready')
    → Future: trigger image processing job (Edge Function or external queue)
         ↓ Reads original from designs-private
         ↓ Generates preview (watermarked, resized)
         ↓ Generates thumbnail (small, fast)
         ↓ Creates media_asset records for 'preview' and 'thumbnail'
         ↓ Updates designs.image_url → signed preview URL
```

### Point B — CDN Delivery
```
media_assets table has: storage_path, storage_bucket
    → Future: CDN path mapping for public previews/thumbnails
              designs-private → designs-public CDN bucket
              (after explicit publish + asset promotion)
```

### Point C — Image Metadata Extraction
```
updateMediaAsset() supports: width, height, file_size
    → Future: After upload, spawn image inspection:
              Read file dimensions → update media_asset
              Used for display (aspect ratio, quality check)
```

### Point D — Re-upload / Version History
```
The partial unique index (non-deleted + asset_type per design) allows
old versions to coexist as status='deleted' for audit/recovery.
    → Future: Version history UI for creators
              Rollback to previous original
```

---

## 6. Routes Added

| Route                                              | Type             | Description                        |
|----------------------------------------------------|------------------|------------------------------------|
| `/[locale]/creator/dashboard/designs/new`          | Server Component | New design creation page           |
| `/[locale]/creator/dashboard/designs/[id]/edit`    | Server Component | Design editing page                |
| `/api/creator/designs`                             | Route Handler    | POST: create draft design          |
| `/api/creator/designs/[id]`                        | Route Handler    | PUT: update draft design           |
| `/api/creator/designs/[id]/upload`                 | Route Handler    | POST: upload design image          |
| `/api/creator/designs/[id]/submit`                 | Route Handler    | POST: submit for review            |

---

## 7. Supabase Impact

**No new migrations required.** All infrastructure was created in Phase 5:

- `media_assets` table ✓
- `designs-private` bucket ✓
- Storage RLS policies ✓
- `submit_design_for_review()` SECURITY DEFINER function ✓
- `insert_own_designs_v4`, `update_own_designs_v4` RLS policies ✓

Phase 7 is a **pure application layer** implementation.

---

## 8. Files Created

### Types
- `types/design-upload.ts` — Phase 7 upload/editor types

### Services
- `services/design-creation.service.ts` — orchestration layer

### Features
- `features/creator/design-editor/DesignForm.tsx` — unified create/edit form
- `features/creator/design-editor/UploadArea.tsx` — drag-and-drop upload component
- `features/creator/design-editor/index.ts` — barrel export

### API Routes
- `app/api/creator/designs/route.ts`
- `app/api/creator/designs/[id]/route.ts`
- `app/api/creator/designs/[id]/upload/route.ts`
- `app/api/creator/designs/[id]/submit/route.ts`

### Pages
- `app/[locale]/creator/dashboard/designs/new/page.tsx`
- `app/[locale]/creator/dashboard/designs/[id]/edit/page.tsx`

### Modified
- `app/[locale]/creator/dashboard/designs/page.tsx` — added "Create new design" CTA
- `lib/i18n.ts` — added `dashboard.designEditor` section (both `fa` and `en`)
- `types/index.ts` — barrel export additions
- `services/index.ts` — barrel export additions
- `docs/design-upload.md` — this file
