// NOTE: In static export mode (output: 'export') this middleware is NOT executed
// at runtime — Next.js static export does not support edge/server middleware.
// This file is kept for completeness and for when the project is run as a
// Node.js server (next start) or deployed to a platform that supports it.
//
// For the GitHub Pages deployment the locale redirect is handled client-side
// by the root page.tsx which redirects to /fa.

export function middleware() {}

export const config = {
  matcher: [],
};
