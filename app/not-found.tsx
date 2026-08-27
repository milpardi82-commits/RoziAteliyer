/**
 * Root not-found page — shown for any unmatched route at the app level.
 * Middleware will redirect bare paths to /fa, so this mainly guards
 * against truly non-existent routes.
 */
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
      <span className="font-display text-8xl font-medium text-muted-foreground/30">404</span>
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
      </div>
      <Link
        href="/fa"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Search size={15} /> Discover designs
      </Link>
    </div>
  );
}
