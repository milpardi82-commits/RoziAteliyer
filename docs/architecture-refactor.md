# Architecture Refactor — Morrow Marketplace

> **Phase:** Foundation Refactor (Pre-Auth)
> **Date:** 2025
> **Status:** Complete

---

## 1. Problem Statement

The original prototype had a working UI but no professional software foundation:

| Problem | Impact |
|---|---|
| All data fetching inside `'use client'` pages via `useEffect` | No SSR, no SEO, slow TTFB, Supabase keys exposed to browser unnecessarily |
| `DesignCard` component duplicated in every page file | Any change required updating 4+ places |
| No server/client boundary | Business logic ran only in the browser |
| Single `lib/supabase.ts` file — no distinction between browser/server clients | Cannot add server-only operations (service role, RLS bypass) in future |
| Types in `lib/types.ts` — no domain separation | Cannot scale to multiple modules |
| No error handling | Unhandled crashes show blank pages |
| No loading states | Layout shift on every navigation |
| No environment validation | Silent failures in production if env vars are missing |

---

## 2. New Architecture

### 2.1 Folder Structure

```
project/
├── app/                        # Next.js App Router
│   ├── [locale]/               # All pages under a locale prefix (fa/en)
│   │   ├── layout.tsx          # Server Component — wraps with LocaleProvider
│   │   ├── page.tsx            # Server Component — fetches data, renders HomePageClient
│   │   ├── loading.tsx         # Streaming skeleton (auto, no code needed)
│   │   ├── error.tsx           # Client Component error boundary
│   │   ├── not-found.tsx       # Localised 404 page
│   │   ├── designs/[slug]/
│   │   │   ├── page.tsx        # Server Component
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── artists/[handle]/
│   │   │   ├── page.tsx        # Server Component
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── discover/
│   │   │   ├── page.tsx        # Server Component
│   │   │   └── loading.tsx
│   │   └── favorites/
│   │       └── page.tsx        # Server Component shell
│   ├── global-error.tsx        # Root-level error boundary
│   └── not-found.tsx           # Root 404
│
├── features/                   # Feature-scoped Client Components
│   ├── home/
│   │   └── HomePageClient.tsx
│   ├── design-detail/
│   │   └── DesignDetailClient.tsx
│   ├── artist-profile/
│   │   └── ArtistProfileClient.tsx
│   ├── discover/
│   │   └── DiscoverClient.tsx
│   └── favorites/
│       └── FavoritesClient.tsx
│
├── components/                 # Reusable UI components
│   ├── design/                 # Design domain components
│   │   ├── DesignCard.tsx      # DesignCard, DesignGrid, DesignImage, DesignMeta, DesignActions
│   │   └── index.ts
│   ├── site-nav.tsx            # SiteHeader, SiteFooter
│   ├── locale-provider.tsx
│   ├── language-switcher.tsx
│   └── ui/                     # shadcn/ui primitives (unchanged)
│
├── services/                   # Server-side data access layer
│   ├── design.service.ts       # getFeaturedDesigns, getDesignBySlug, getDesignsByCreator, getCategories
│   ├── creator.service.ts      # getCreatorByHandle
│   ├── review.service.ts       # getReviewsByDesign
│   └── index.ts                # Barrel export
│
├── types/                      # Domain types
│   ├── marketplace.ts          # Creator, Shop, Design, Category, Collection, Review, DesignSortOption
│   └── index.ts                # Barrel export
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase singleton
│   │   ├── server.ts           # Server Supabase factory function
│   │   └── index.ts            # Barrel + legacy re-export
│   ├── env.ts                  # Validated environment configuration
│   ├── i18n.ts                 # Translations + locale config (unchanged)
│   ├── utils.ts                # cn(), formatCompact(), clamp()
│   ├── supabase.ts             # @deprecated — backwards compat shim
│   └── types.ts                # @deprecated — backwards compat shim
│
└── middleware.ts               # Locale redirect (unchanged)
```

---

## 3. Architectural Layers

### Layer 1 — Data Access (Server-only)
**Location:** `services/`

All Supabase queries. Called only from Server Components, Server Actions, or API Routes. Never imported from `'use client'` files. Provides graceful fallbacks so pages never crash from a failed DB call.

```
Server Component → services/*.service.ts → lib/supabase/server.ts → Supabase
```

### Layer 2 — Server Components (Next.js App Router)
**Location:** `app/[locale]/*/page.tsx`

Thin orchestrators:
1. Validate locale params
2. Call service functions
3. Pass data as props to Client Components
4. Call `notFound()` when entities don't exist
5. Export `generateMetadata()` for SSR SEO

No business logic. No UI.

### Layer 3 — Feature Client Components
**Location:** `features/`

One file per page. Receives server-fetched data as props. Owns only interactive state (favourite toggles, search, sort, mobile menu). Uses `supabaseClient` for dynamic client-side category refetch (Discover page only).

### Layer 4 — Reusable Components
**Location:** `components/`

Pure, composable UI. No data fetching. No page-specific logic.

- `components/design/` — DesignCard family
- `components/site-nav.tsx` — SiteHeader, SiteFooter
- `components/ui/` — shadcn primitives (untouched)

---

## 4. Server/Client Boundary Rules

| Import | Server Component | Client Component |
|---|---|---|
| `lib/supabase/server` | ✅ | ❌ Never |
| `lib/supabase/client` | ❌ | ✅ |
| `services/*` | ✅ | ❌ Never |
| `types/*` | ✅ | ✅ |
| `lib/env` | ✅ | ✅ (NEXT_PUBLIC_ only) |
| `components/*` | ✅ (unless 'use client') | ✅ |
| `features/*` | ✅ (as leaf) | ✅ |

---

## 5. What Changed

### Before vs After

| Before | After |
|---|---|
| `app/[locale]/page.tsx` → re-export of `app/page.tsx` | `app/[locale]/page.tsx` → real Server Component with data fetching |
| Data fetched in `useEffect` on the client | Data fetched in Server Component, passed as props |
| `DesignCard` defined inline in 4 separate page files | Single `components/design/DesignCard.tsx` with sub-components |
| `lib/supabase.ts` — one file, no server/client distinction | `lib/supabase/client.ts` + `lib/supabase/server.ts` |
| `lib/types.ts` — monolithic types file | `types/marketplace.ts` with barrel export |
| No error handling | `error.tsx` + `loading.tsx` + `not-found.tsx` at every route level |
| No env validation | `lib/env.ts` validates all variables at startup |
| `app/page.tsx` massive 164-line 'use client' monolith | Thin Server Component + focused Client Component |

---

## 6. What Was Preserved

- **All visual design** — no CSS or Tailwind classes changed in feature components
- **Persian RTL support** — `locale-provider.tsx`, `language-switcher.tsx`, `i18n.ts` untouched
- **Middleware locale routing** — untouched
- **`app/[locale]/layout.tsx`** — unchanged (already a Server Component with `LocaleProvider`)
- **`components/site-nav.tsx`** — unchanged
- **`components/ui/`** — all shadcn primitives untouched
- **`app/globals.css`** — untouched
- **Fallback designs** — moved from inline page code to `services/design.service.ts`

---

## 7. SEO Improvements

Every route now exports `generateMetadata()` with:
- Per-page title (bilingual)
- Per-page description (bilingual)
- OpenGraph image (design detail pages use the design's image)

Previously: only the root layout had metadata; all inner pages had no SEO metadata.

---

## 8. Performance Improvements

| Metric | Before | After |
|---|---|---|
| Time to First Byte | ~client-side only (empty HTML) | Server-rendered HTML with content |
| Initial JS bundle | Includes all data-fetching logic | Data fetching moved to server |
| Loading states | Implicit (blank flash) | Explicit `loading.tsx` skeletons |
| Error states | Blank crash | Graceful `error.tsx` with recovery |

---

## 9. Not Implemented (Future Phases)

The following were **deliberately excluded** per project scope:

- Authentication (Phase 2)
- Cart, Checkout, Payment, Orders (Commerce — Phase 4)
- Portfolio module (Phase 3)
- Education module (Phase 3)
- Owner Online Shop (Phase 3)
- Zod validation schemas for forms (ready to add in Phase 2)
- Server Actions (ready to add in Phase 2)
- API Routes (ready to add in Phase 2)

---

## 10. Migration Strategy for Remaining Old Files

The following old files are still present for backwards compatibility but should be
cleaned up in the next phase:

| File | Status | Action |
|---|---|---|
| `app/page.tsx` | Legacy | Can be deleted once `app/[locale]/page.tsx` is confirmed working |
| `app/designs/[slug]/page.tsx` | Legacy | Can be deleted |
| `app/artists/[handle]/page.tsx` | Legacy | Can be deleted |
| `app/discover/page.tsx` | Legacy | Can be deleted |
| `app/favorites/page.tsx` | Legacy | Can be deleted |
| `lib/supabase.ts` | Shim | Remove when all imports updated |
| `lib/types.ts` | Shim | Remove when all imports updated |

---

## 11. Next Recommended Phase — Authentication Foundation

1. Add Supabase Auth (email + magic link)
2. Create `lib/supabase/auth-server.ts` using `createServerClient` from `@supabase/ssr`
3. Add `app/[locale]/auth/` route group (login, callback)
4. Protect server routes with `getUser()` check
5. Persist favourites to `user_favorites` table
6. Add user profile page `app/[locale]/profile/`
7. After auth: implement creator dashboard (upload designs, manage listings)
