/**
 * Locale-level not-found page.
 * Shown when notFound() is called from any [locale]/* route segment
 * (e.g. design or artist not found in database).
 */
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
      <span className="font-display text-8xl font-medium text-muted-foreground/30">۴۰۴</span>
      <div>
        <h1 className="font-display text-2xl font-medium">صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          این صفحه وجود ندارد یا حذف شده است.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/fa" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          <Search size={15} /> کاشف طراحی‌ها
        </Link>
        <Link href="/fa/discover" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
          مرور همه طراحی‌ها
        </Link>
      </div>
    </main>
  );
}
