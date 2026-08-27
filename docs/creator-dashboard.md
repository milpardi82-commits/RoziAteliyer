# Creator Dashboard — Architecture & Implementation Guide

**Phase:** 6  
**Status:** Foundation Complete  
**Route:** `/[locale]/creator/dashboard`

---

## 1. Dashboard Architecture

The Creator Dashboard is a private, creator-only section of the Morrow Marketplace. It sits entirely within the existing `app/[locale]/` route group and uses the established design system without introducing any new visual language.

### Architecture overview

```
app/[locale]/creator/dashboard/
├── layout.tsx          ← Auth guard + access gate + nav shell
├── loading.tsx         ← Streaming skeleton
├── page.tsx            ← Overview tab (default)
├── designs/
│   └── page.tsx        ← My Designs tab (paginated)
├── collections/
│   └── page.tsx        ← Collections tab (Phase 6 placeholder)
└── profile/
    └── page.tsx        ← Creator Profile tab
```

```
features/creator/dashboard/
├── index.ts
├── DashboardNav.tsx                  ← Client: tab navigation
├── DashboardOverview.tsx             ← Server: stats + welcome panel
├── DashboardDesignList.tsx           ← Server: paginated design table
├── DashboardProfileForm.tsx          ← Client: creator profile editor
├── DashboardCollectionsPlaceholder.tsx ← Server: coming-soon panel
└── DashboardGates.tsx                ← Server: access gate states
```

```
services/dashboard.service.ts         ← Server-only data layer
types/dashboard.ts                    ← Dashboard-specific types
```

---

## 2. Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/{locale}/creator/dashboard` | `page.tsx` | Overview: stats + recent 5 designs |
| `/{locale}/creator/dashboard/designs` | `designs/page.tsx` | Full paginated design list |
| `/{locale}/creator/dashboard/collections` | `collections/page.tsx` | Collections (Phase 6 placeholder) |
| `/{locale}/creator/dashboard/profile` | `profile/page.tsx` | Creator profile editor |

All routes are wrapped by `layout.tsx` which provides the shared shell (header, nav, footer) and enforces access control.

---

## 3. Authentication Flow

```
Request to /[locale]/creator/dashboard
          ↓
middleware.ts  ──→  not authenticated  ──→  redirect /auth/login?next=…
          ↓
          authenticated
          ↓
layout.tsx  ──→  getServerUser() (belt-and-suspenders)
          ↓
          getDashboardCreator()  →  resolves creators row by user_id
          ↓
    ┌─────┴──────────────────────┐
    │  creator row exists?        │
    └─────┬──────────────────────┘
          │ no  ──→  NotCreatorGate  (CTA: Apply now)
          │
          ├ status = 'pending'    ──→  PendingCreatorGate
          ├ status = 'suspended'  ──→  SuspendedCreatorGate
          └ status = 'approved'   ──→  Dashboard rendered
```

Two layers of authentication:
1. **Middleware** (`middleware.ts`) — blocks unauthenticated requests, redirects to login.
2. **Layout** (`layout.tsx`) — re-validates session server-side; also resolves creator status and renders the correct access gate.

---

## 4. Creator Permission Model

### What creators CAN do in Phase 6

| Action | Enforcement |
|--------|-------------|
| View own dashboard overview | Server-side: `creators.user_id = auth.uid()` |
| View own designs (all statuses) | RLS: `read_own_designs` policy |
| View own collections | RLS: `read_own_collections` policy |
| Edit own creator profile (display_name, bio, website, location) | RLS: `update_own_creator_v3` |
| See aggregate stats about own designs | Server-side COUNT queries, scoped to `creator_id` |

### What creators CANNOT do

| Action | Why |
|--------|-----|
| See another creator's dashboard | `getDashboardCreator()` resolves from session only |
| Modify another creator's designs | RLS `update_own_designs_v4` blocks it |
| Access another creator's media | RLS on `media_assets` blocks it |
| Self-escalate design status to `published` | RLS `update_own_designs_v4` CHECK clause |
| Change their own `handle` or `status` | Not in `CreatorProfileUpdate`; update payload whitelist |
| Access dashboard while suspended | `SuspendedCreatorGate` blocks UI access |

---

## 5. Data Fetching Strategy

### Server Components (no client JS)

The dashboard uses **Server Components** by default. Data is fetched server-side and passed as props.

**`getCreatorDashboardData()`** — main entry point for the Overview page:
- Resolves session creator in one query
- Fetches stats (7 parallel COUNT queries) and designs (1 paginated query)
- **Total: 2 serial round-trips** (session → stats+designs in parallel)
- No waterfalls; no client-side database calls

**`getCreatorDesignSummary()`** — paginated design list:
- Selects only the columns needed (no heavy fields like `colors[]`, `description`)
- `pageSize` capped at 50; default 20
- Server-side status filtering via `.eq('status', ...)`
- Uses Supabase `.range()` for efficient offset pagination

**`getCreatorDashboardStats()`** — overview stats:
- 7 COUNT queries run in parallel via `Promise.all()`
- HEAD=true: no row data transferred, only the count
- All queries scoped to `creator_id` (RLS enforces ownership)

### Client Components

Only two client components exist in the dashboard:
- **`DashboardNav`** — uses `usePathname()` for active state
- **`DashboardProfileForm`** — uses `supabaseAuthClient()` for the creator profile update form (same pattern as existing `ProfileClient`)

---

## 6. Security Review

### RLS policies relied upon

| Table | Policy | Effect |
|-------|--------|--------|
| `creators` | `read_own_creator_row` | Creator can see own row at any status |
| `creators` | `update_own_creator_v3` | Creator can update own profile fields |
| `designs` | `read_own_designs` | Creator can see all own designs (all statuses) |
| `designs` | `update_own_designs_v4` | Creator cannot escalate to `published`/`approved` |
| `collections` | `read_own_collections` | Creator can see all own collections |

### Server-side enforcement

All data access in `services/dashboard.service.ts` uses `createSupabaseServerClient()` — the cookie-aware, session-enforced client. No anon client is used for any creator-owned data. Creator identity is **always** resolved from `auth.uid()` via `creators.user_id`, never accepted from route parameters or client input.

### Cross-creator isolation

`getDashboardCreator()` calls `supabase.auth.getUser()` and then queries `creators WHERE user_id = auth.uid()`. This means Creator A's session can never return Creator B's data — the query is structurally tied to the authenticated identity.

---

## 7. Supabase Impact Report

**No new migrations were created for Phase 6.** All required database infrastructure already exists from previous phases:

| Phase | What it provides |
|-------|-----------------|
| Phase 3 | `creators` table, `creator_applications`, RLS `update_own_creator_v3`, `read_own_creator_row` |
| Phase 4 | `designs.status` column, `read_own_designs` / `update_own_designs_v4` RLS, `collections.status` |
| Phase 5 | `media_assets` table and storage RLS (not modified) |

Phase 6 adds:
- **Zero new tables**
- **Zero new columns**  
- **Zero new RLS policies**
- **Zero new migrations**
- **Zero impact on existing seed data**

---

## 8. UI Decisions

- Dashboard uses the same `[#f2efe8]` header band as all other pages
- Stats cards use `[#f7f6f2]` background — same as existing feature cards
- Tab navigation follows the same border-bottom active indicator pattern common to the design system
- `DesignStatusBadgeLocalized` reuses the existing status badge with locale awareness
- All text goes through the i18n dictionary (`dict.dashboard.*`)
- RTL is fully supported — Tailwind's `start`/`end` logical properties are used throughout

---

## 9. Performance Considerations

| Concern | Solution |
|---------|----------|
| Loading all designs | Paginated at 20/page; max 50 per request |
| Client-side filtering | All filtering via Supabase `.eq()` server-side |
| Stats calculation in JS | 7 parallel `COUNT(*)` queries with `head: true` |
| Unnecessary data transfer | Design list selects only 11 columns; omits `colors[]`, `description`, `admin_note` |
| Multiple serial round-trips | `Promise.all()` for stats + designs in parallel |
| Large page re-renders | Server Components for all data display; only Nav and ProfileForm are Client Components |

---

## 10. Future Extension Points

### Phase 7 — Design Upload
- The `app/[locale]/creator/dashboard/designs/new/` route can be added without modifying existing files
- The upload area is architecturally prepared in the My Designs empty state CTA
- `services/media.service.ts` is already complete for file record management
- The `UPLOAD_CONSTRAINTS` and `buildStoragePath()` functions are ready

### Phase 8 — Collection Management
- `app/[locale]/creator/dashboard/collections/` already exists as a placeholder
- `DashboardCollectionsPlaceholder` shows the coming-soon state
- The `collections` table and its RLS policies are complete
- The `Collection` and `CreateCollectionInput` types are already in `types/design.ts`

### Phase 9 — Design Editing
- The Edit action link in `DashboardDesignList` points to `…/designs/[id]/edit`
- `updateDraftDesign()` in `design.service.ts` is complete
- Only the UI page needs to be created

### Phase 10 — Analytics
- The `view_count`, `favorite_count`, `review_count`, `avg_rating` columns are available
- `getCreatorDashboardStats()` can be extended to include performance metrics

### Phase 11 — Admin Panel
- The SECURITY DEFINER functions `publish_design()`, `unpublish_design()`, `archive_design()`, `approve_creator_application()` are all ready
- An admin dashboard can be added at `app/[locale]/admin/`
