# Authentication Audit — Morrow Marketplace

**Date:** Phase 2 Implementation  
**Author:** Phase 2 Authentication Engineer  
**Status:** Pre-implementation analysis

---

## 1. Current Authentication Status

**State: NO AUTHENTICATION IMPLEMENTED**

The project currently has:
- No login/signup pages
- No session management
- No protected routes
- No auth guards in middleware
- No user identity tied to any action

All user interactions (favorites, follows) are **ephemeral and client-side only**. They are lost on page refresh.

---

## 2. Current Supabase Setup

### Clients

| File | Type | Issue |
|------|------|-------|
| `lib/supabase/client.ts` | Browser | Uses base `createClient` — **`persistSession: false`** means auth sessions are NOT persisted |
| `lib/supabase/server.ts` | Server | Uses base `createClient` — **not cookie-aware**, cannot read session from request cookies |
| `lib/supabase/index.ts` | Barrel | Re-exports both |

**Critical Gap:** Neither client is SSR-safe for authentication. The server client does not read cookies from the request context. The browser client does not persist sessions.

### Package

- `@supabase/supabase-js`: `^2.58.0` ✅ (present)
- `@supabase/ssr`: ❌ **NOT INSTALLED** (required for SSR-safe auth)

### Environment Variables

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Required, validated at startup |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required, validated at startup |
| `NEXT_PUBLIC_SITE_URL` | Optional, defaults to `https://morrow.market` |

No service-role key present or needed for Phase 2.

---

## 3. Existing Database Schema (Supabase)

### Tables (from migrations)

| Table | Auth-linked? | Notes |
|-------|-------------|-------|
| `categories` | No | Public read, no auth needed |
| `creators` | Via `user_id` | Has nullable `user_id` FK → `auth.users`. Was decoupled for seeding. |
| `shops` | Via creator | FK to creators |
| `designs` | Via creator | FK to creators |
| `design_categories` | Indirect | Via designs |
| `design_tags` | Indirect | Via designs |
| `tags` | No | Public read |
| `collections` | Via creator | FK to creators |
| `collection_items` | Via collection | FK to collections |
| `reviews` | Via creator | FK to creators |
| `favorites` | Via creator | FK to creators — **not usable for regular users yet** |
| `follows` | Via creator | FK to creators |

### Critical Finding: Missing `user_profiles` Table

The current schema uses `creators` as the only user-linked table. Regular (non-creator) users have **no profile table**. The `favorites` table requires a `creator_id` FK — meaning only creators can save favorites.

**This is a design gap.** For Phase 2, we need:
1. A `user_profiles` table for ALL registered users
2. A `user_favorites` table for non-creator users

### Existing RLS Policies

All tables have RLS enabled. Policies use `auth.uid()` correctly for write operations. Read policies are appropriately open for public marketplace data.

**Gap:** The `creators` ownership policies use `auth.uid() = user_id` (the nullable column). This works but requires `user_id` to be set when a creator registers.

---

## 4. Current Middleware

```typescript
// middleware.ts — currently ONLY handles locale routing
// No auth checks whatsoever
```

**Action Required:** Extend middleware to:
1. Use `@supabase/ssr` for session refresh
2. Add route protection for `/profile`, future dashboard routes

---

## 5. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| Breaking existing marketplace data | HIGH | All new tables are additive; no existing columns modified |
| Breaking existing Supabase queries | MEDIUM | Existing `supabaseServer()` / `supabaseClient` kept for data queries |
| Session cookie conflicts | LOW | Using `@supabase/ssr` standard cookie names |
| Existing favorites UX breaking | LOW | Client-side favorites preserved until auth favorites ready |
| RLS policy conflicts | LOW | New policies are additive |
| Auth redirect loops | MEDIUM | Careful middleware logic with explicit allow-lists |

---

## 6. Required Changes

### New (additive):
1. Install `@supabase/ssr`
2. New `lib/supabase/auth-client.ts` — browser SSR client
3. New `lib/supabase/auth-server.ts` — server SSR client (cookie-aware)
4. New `lib/auth/` — auth service layer
5. New migration: `user_profiles` table
6. New migration: `user_favorites` table (decoupled from `creators`)
7. New routes: `/[locale]/auth/login`, `/[locale]/auth/signup`, `/[locale]/auth/callback`
8. New route: `/[locale]/profile`
9. Extended middleware: session refresh + route protection

### Modified (minimal):
1. `middleware.ts` — add Supabase session handling + route guards
2. `lib/supabase/client.ts` — enable session persistence
3. `components/site-nav.tsx` — add auth state (login/profile link)

### NOT Modified:
- All existing pages and layouts
- All existing services
- All existing marketplace data queries
- All existing RLS policies on marketplace tables
- All existing UI components
- All existing Supabase schema tables

---

## 7. Implementation Plan

### Migration 1: `user_profiles`
- Additive new table
- Triggered automatically on `auth.users` insert
- Risk level: **SAFE** — does not touch existing tables

### Migration 2: `user_favorites`  
- New table separate from existing `favorites` (which requires `creator_id`)
- Allows any authenticated user to save designs
- Risk level: **SAFE** — additive only

### Auth Flow
```
Signup → auth.users created → trigger → user_profiles auto-created
Login → session cookie set → SSR reads session → profile available
```
