# Creator Collections — Architecture & Implementation Guide

**Phase:** 12  
**Status:** Complete  
**Routes:**
- `/[locale]/creator/dashboard/collections`
- `/[locale]/creator/dashboard/collections/[id]`

---

## 1. Audit Findings

### What Already Existed (Phases 1–11)

| Layer | Existed? | Location |
|-------|----------|----------|
| `collections` table + RLS v1 | ✅ | Migration `20260823092308` |
| `collection_items` table + RLS v1 | ✅ | Migration `20260823092308` |
| `status` column + RLS v4 (ownership fixed) | ✅ | Migration `20260826000000` |
| `Collection`, `CollectionItem`, `CreateCollectionInput` types | ✅ | `types/design.ts` |
| `getMyCollections()` | ✅ | `services/collection.service.ts` |
| `getCollectionWithItems()` | ✅ | `services/collection.service.ts` |
| `createCollection()` | ✅ | `services/collection.service.ts` |
| `addDesignToCollection()` | ✅ | `services/collection.service.ts` |
| `removeDesignFromCollection()` | ✅ | `services/collection.service.ts` |
| `getCollectionsContainingDesign()` | ✅ | `services/collection.service.ts` |
| Dashboard nav link to `/collections` | ✅ | `DashboardNav.tsx` |
| Collections stat on overview | ✅ | `DashboardOverview.tsx` |
| `/collections` page (placeholder) | ✅ | `app/[locale]/creator/dashboard/collections/page.tsx` |
| FA + EN basic i18n keys | ✅ | `lib/i18n.ts` |

### What Was Missing (Added in Phase 12)

| Item | Added Where |
|------|-------------|
| `updateCollection()` service function | `services/collection.service.ts` |
| `deleteCollection()` service function | `services/collection.service.ts` |
| `UpdateCollectionInput` type | `services/collection.service.ts` |
| `GET /api/creator/collections` | `app/api/creator/collections/route.ts` |
| `POST /api/creator/collections` | `app/api/creator/collections/route.ts` |
| `PUT /api/creator/collections/[id]` | `app/api/creator/collections/[id]/route.ts` |
| `DELETE /api/creator/collections/[id]` | `app/api/creator/collections/[id]/route.ts` |
| `POST /api/creator/collections/[id]/designs` | `app/api/creator/collections/[id]/designs/route.ts` |
| `DELETE /api/creator/collections/[id]/designs` | `app/api/creator/collections/[id]/designs/route.ts` |
| `DashboardCollectionList` component | `features/creator/dashboard/DashboardCollectionList.tsx` |
| `DashboardCollectionDetail` component | `features/creator/dashboard/DashboardCollectionDetail.tsx` |
| Collection list page (replaces placeholder) | `app/[locale]/creator/dashboard/collections/page.tsx` |
| Collection detail route | `app/[locale]/creator/dashboard/collections/[id]/page.tsx` |
| Full FA + EN collection management i18n keys | `lib/i18n.ts` |

---

## 2. Database

**No migration was required.** All tables, columns, indexes, and RLS policies were created in prior phases.

### Tables used

#### `collections`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | Auto-generated |
| `creator_id` | `uuid FK → creators.id` | Nullable for system collections |
| `name` | `text NOT NULL` | |
| `description` | `text` | Optional |
| `cover_image_url` | `text` | Optional |
| `is_public` | `boolean NOT NULL DEFAULT true` | |
| `status` | `text CHECK(draft/published/archived)` | Added Phase 4 |
| `item_count` | `integer NOT NULL DEFAULT 0` | Denormalised |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

#### `collection_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | Auto-generated |
| `collection_id` | `uuid FK → collections.id ON DELETE CASCADE` | |
| `design_id` | `uuid FK → designs.id ON DELETE CASCADE` | |
| `added_at` | `timestamptz` | |
| `UNIQUE(collection_id, design_id)` | | Prevents duplicate membership |

### RLS Policies (all pre-existing)

| Policy | Table | Effect |
|--------|-------|--------|
| `read_published_collections` | `collections` | Anon + auth can read `is_public=true AND status='published'` |
| `read_own_collections` | `collections` | Authenticated creator can read own collections (all statuses) |
| `insert_own_collections_v4` | `collections` | Creator can insert collections scoped to own `creator_id` |
| `update_own_collections_v4` | `collections` | Creator can update own collections only |
| `delete_own_collections_v4` | `collections` | Creator can delete own collections only |
| `read_collection_items` | `collection_items` | All can read |
| `insert_own_collection_items_v4` | `collection_items` | Creator can add items to own collections |
| `delete_own_collection_items_v4` | `collection_items` | Creator can remove items from own collections |

---

## 3. Ownership Model

```
auth.uid()
    ↓
creators.user_id  →  creators.id  (resolveAuthenticatedCreatorId)
    ↓
collections.creator_id
    ↓
collection_items.collection_id
```

For design membership:

```
creator.id
    ↓ must own both ↓
collections.creator_id = creator.id  AND  designs.creator_id = creator.id
```

**Creator identity is always resolved server-side** via `resolveAuthenticatedCreatorId()` which:
1. Reads the authenticated session from the server-side Supabase client
2. Looks up `creators` row by `user_id = auth.uid()`
3. Requires `status = 'approved'`
4. Returns `creators.id` — never trusts client input

---

## 4. Service Layer

All functions live in `services/collection.service.ts`. Server-only — never import from client components.

### Queries

| Function | Description |
|----------|-------------|
| `getMyCollections()` | Returns all draft/published collections for the authenticated creator |
| `getCollectionWithItems(id)` | Returns a single collection + its design items (RLS-gated) |
| `getCollectionsContainingDesign(designId)` | Returns collection IDs containing a specific design |

### Mutations

| Function | Description |
|----------|-------------|
| `createCollection(input)` | Creates a collection scoped to session creator. Starts as `draft, is_public=false` |
| `updateCollection(id, input)` | Partial update — only provided fields are changed. Ownership enforced by RLS + explicit `.eq('creator_id', creatorId)` |
| `deleteCollection(id)` | Deletes collection + items (CASCADE). Ownership enforced by RLS |
| `addDesignToCollection(collectionId, designId)` | Dual ownership check: both collection and design must belong to the creator |
| `removeDesignFromCollection(collectionId, designId)` | Verifies collection ownership before deletion |

---

## 5. API Routes

### `GET /api/creator/collections`
Returns the authenticated creator's collections.

### `POST /api/creator/collections`
Creates a new collection.  
**Body:** `{ name: string, description?: string, is_public?: boolean }`  
**Response 201:** `{ id, name, status, item_count }`

### `PUT /api/creator/collections/[id]`
Updates a creator's own collection.  
**Body:** `{ name?: string, description?: string, is_public?: boolean }`  
**Response 200:** `{ id, name, status, item_count }`

### `DELETE /api/creator/collections/[id]`
Deletes a creator's own collection (and all its items via CASCADE).  
**Response 200:** `{ success: true }`

### `POST /api/creator/collections/[id]/designs`
Adds a design to the collection. Both collection and design must be owned by the creator.  
**Body:** `{ design_id: string }`  
**Response 200:** `{ success: true }`

### `DELETE /api/creator/collections/[id]/designs`
Removes a design from the collection. Collection must be owned by the creator.  
**Body:** `{ design_id: string }`  
**Response 200:** `{ success: true }`

All routes return `{ error: true, message: string }` with appropriate HTTP status codes on failure.

---

## 6. Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/{locale}/creator/dashboard/collections` | `DashboardCollectionList` (client) | List + create + edit + delete collections |
| `/{locale}/creator/dashboard/collections/[id]` | `DashboardCollectionDetail` (client) | View + add/remove designs |

Both routes are Server Components that fetch data server-side and pass it to Client Components for mutations.

---

## 7. UI Components

### `DashboardCollectionList`
- Lists all creator collections as cards
- Create collection form (inline)
- Inline edit form per collection card
- Delete with two-click confirmation (tap once to arm, tap again to confirm)
- Links to collection detail page
- Empty state when no collections exist
- Mutations call API routes then invoke `router.refresh()` to re-read server data

### `DashboardCollectionDetail`
- Lists designs in the collection as a table
- Add-design panel with select dropdown (filters out already-added and archived designs)
- Remove design with two-click confirmation
- Back link to collections list
- Empty state when no designs in collection

---

## 8. Internationalization

All user-facing strings are in `lib/i18n.ts` under `dashboard.*`.

**Keys added in Phase 12** (both `fa` and `en`):

```
collectionsEmpty, collectionsEmptyDesc,
collectionCreate, collectionName, collectionNamePlaceholder, collectionNameRequired,
collectionDescription, collectionDescriptionPlaceholder, collectionIsPublic,
collectionCreateSuccess, collectionCreateError,
collectionEditTitle, collectionSaveChanges, collectionSaving,
collectionUpdateSuccess, collectionUpdateError,
collectionDelete, collectionDeleteConfirm, collectionDeleteSuccess, collectionDeleteError,
collectionItems, collectionItemCount,
collectionAddDesign, collectionRemoveDesign,
collectionRemoveSuccess, collectionRemoveError,
collectionAddSuccess, collectionAddError,
collectionDesignsEmpty, collectionSelectDesign,
collectionBackToList,
collectionStatusDraft, collectionStatusPublished, collectionStatusArchived,
collectionCancelBtn, collectionOpenBtn
```

---

## 9. Security

### Authentication checks
Every API route and Server Component verifies the session via `createSupabaseServerClient()`.

### Creator resolution
`resolveAuthenticatedCreatorId()` is called in every mutation. It requires `creators.status = 'approved'`. Pending or suspended creators cannot modify collections.

### Ownership enforcement — two layers

**Layer 1 — Service layer explicit check:**
```typescript
// Example from updateCollection()
.eq('creator_id', creatorId)
```
If the collection doesn't belong to this creator, the row count is zero and the function returns `collection_not_found_or_not_owned`.

**Layer 2 — Postgres RLS:**
Even if the service check were bypassed, the `update_own_collections_v4` policy blocks the write:
```sql
USING  (public.auth_user_owns_creator(creator_id))
WITH CHECK (public.auth_user_owns_creator(creator_id))
```

### Design ownership (add to collection)
`addDesignToCollection()` performs two parallel queries:
1. Verifies `collection.creator_id = creatorId`
2. Verifies `design.creator_id = creatorId`

Only if both pass does the insert proceed. This prevents Creator A from adding Creator B's designs.

### What is prevented
| Action | Prevented by |
|--------|-------------|
| Creator B reading Creator A's draft collections | RLS `read_own_collections` |
| Creator B modifying Creator A's collections | RLS v4 + service `.eq('creator_id', ...)` |
| Creator A adding Creator B's design | Service dual ownership check |
| Anonymous user mutating collections | Auth check in every route handler |
| Client supplying a `creator_id` | creator_id always resolved from session, never from body |

---

## 10. Future Extension Points

- **Collection status workflow**: `updateCollection()` accepts `status` changes if added to `UpdateCollectionInput`
- **Cover images**: `cover_image_url` column exists; upload UI can be added without schema changes
- **Ordering**: Add a `position` column to `collection_items` — service layer already uses `.order('added_at', ...)` which can be swapped
- **Public collection pages**: `/designs/collections/[id]` marketplace route (separate from dashboard)
- **Batch add designs**: API route can accept `design_ids: string[]` with minor service changes
