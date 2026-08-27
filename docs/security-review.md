# Phase 2 Security Review

**Date:** Phase 2 Implementation  
**Scope:** Authentication, sessions, RLS, cookie security, client exposure

---

## 1. Environment Variables

| Variable | Visibility | Safe? | Notes |
|----------|-----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser) | ✅ | URL is not a secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser) | ✅ | Designed to be public — RLS enforces access |
| No service role key | N/A | ✅ | NOT needed for Phase 2; would be server-only |

**Rule enforced:** `lib/env.ts` validates all required vars at startup. All env access centralised — no `process.env` reads scattered through the codebase.

---

## 2. Session Handling

### Cookie Security (via `@supabase/ssr`)

The new `lib/supabase/auth-server.ts` and `middleware.ts` use `createServerClient` from `@supabase/ssr`.

- **HttpOnly cookies:** Supabase SSR sets auth cookies as `HttpOnly` by default — JavaScript cannot read them via `document.cookie`.
- **SameSite:** Set to `Lax` by default — CSRF protection for most cases.
- **Secure:** Set to `Secure` in production (HTTPS-only).
- **Token refresh:** Middleware calls `supabase.auth.getUser()` (NOT `getSession()`) on every request — this is the Supabase-recommended pattern to ensure the token is always validated against the server.

### Why `getUser()` not `getSession()` in middleware

`getSession()` trusts the JWT in the cookie without re-validating it against Supabase Auth. `getUser()` makes a server-round-trip to validate the token, protecting against tampered or expired JWTs reaching protected routes.

---

## 3. Row Level Security (RLS)

### Existing tables — unchanged

All existing RLS policies remain intact. No modifications.

### New tables (Phase 2)

#### `user_profiles`

| Operation | Policy | Notes |
|-----------|--------|-------|
| SELECT | Anyone (anon + auth) | Public profiles — safe for marketplace |
| UPDATE | `auth.uid() = id` only | Users can only edit their own profile |
| INSERT | `auth.uid() = id` only | Blocked from direct insert; trigger handles creation |
| DELETE | Not granted | Profiles are not deletable by users |

#### `user_favorites`

| Operation | Policy | Notes |
|-----------|--------|-------|
| SELECT | `auth.uid() = user_id` | Private — users only see their own favorites |
| INSERT | `auth.uid() = user_id` | Users can only add to their own list |
| DELETE | `auth.uid() = user_id` | Users can only remove from their own list |

**No anon access to `user_favorites`** — this table is private by design.

---

## 4. Auth Flow Security

### Signup
- Password min length enforced client-side (8 chars) + Supabase enforces server-side
- Email confirmation required before account is activated
- Display name passed as user metadata, not email (no PII in metadata beyond what user provides)
- Auto-profile creation via PostgreSQL trigger (SECURITY DEFINER) — cannot be bypassed

### Login
- Uses `signInWithPassword` — standard credential auth
- Failed login shows generic error (does not reveal whether email exists)
- After login: `router.refresh()` invalidates RSC cache so server components re-render with auth state

### Logout
- Uses `supabase.auth.signOut()` — clears session cookies
- Followed by `router.refresh()` to clear auth state from cache

### Auth Callback (OAuth / Email Confirm)
- `/api/auth/callback` exchanges one-time `code` for session
- If exchange fails, redirects to login with `error` param (no sensitive info exposed)
- Uses `NextRequest`/`NextResponse` directly — no cookie leaks

---

## 5. Protected Route Guards

### Middleware approach
- Middleware runs on every matched request (server-side, before rendering)
- Uses `getUser()` (server-validated) — not client state
- Redirect includes `?next=` for post-login redirect
- Auth-only routes (login/signup) redirect authenticated users away

### Explicit protected paths
```typescript
const PROTECTED_PATHS = ['/profile'];
```

Future paths (dashboard, creator area) simply get added to this array.

---

## 6. Client Exposure Risks — Addressed

| Risk | Status |
|------|--------|
| Service role key in browser | ✅ Not present anywhere |
| Session JWT exposed to JS | ✅ HttpOnly cookies prevent this |
| User ID in URL params | ✅ Not used in any URL |
| Other users' favorites visible | ✅ RLS `auth.uid() = user_id` prevents |
| Profile data of other users leaked | ✅ Only public profile fields readable |

---

## 7. No-Change Verification for Existing Data

- All 3 existing migrations: **unmodified**
- All existing RLS policies: **unmodified**
- Existing `creators`, `designs`, `shops`, `categories` tables: **unmodified**
- Existing `supabaseServer()` and `supabaseClient` patterns: **preserved** (data queries still work)
- New migration only adds `user_profiles` and `user_favorites` tables

---

## 8. Remaining Security Considerations (Future Phases)

1. **Rate limiting** — Supabase Auth has built-in rate limiting; review for production
2. **Avatar upload** — If added, validate file type + size server-side
3. **Username uniqueness** — DB unique constraint on `user_profiles.username` enforces this
4. **Creator promotion** — When a user becomes a Creator, use a server action with `auth.uid()` check; never trust client-side role claims
5. **Service role key** — Will be needed for admin operations; store as server-only env var without `NEXT_PUBLIC_` prefix
