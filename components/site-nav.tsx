'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, Leaf, Menu, Search, User, X } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import { LanguageSwitcher } from '@/components/language-switcher';
import { toPersianNumber } from '@/lib/i18n';
import { useAuthUser } from '@/hooks/use-auth-user';

export function SiteHeader({ favoriteCount = 0 }: { favoriteCount?: number }) {
  const { locale, dict, isRTL } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/${locale}`;
  const favCount = isRTL ? toPersianNumber(favoriteCount) : favoriteCount;
  const { user } = useAuthUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-10">
          <Link href={base} className="group flex items-center gap-2.5" aria-label={dict.brandName}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:rotate-[-8deg]">
              <Leaf size={19} strokeWidth={2.5} />
            </span>
            <span className="font-display text-[26px] font-semibold tracking-[-0.04em]">{dict.brandName}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-muted-foreground lg:flex">
            <Link href={`${base}`} className="transition-colors hover:text-foreground">{dict.nav.discover}</Link>
            <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.browse}</Link>
            <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.categories}</Link>
            <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.artists}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href={`${base}/discover`} className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={dict.nav.search}>
            <Search size={19} />
          </Link>
          <Link href={`${base}/favorites`} className="relative rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={dict.nav.favorites}>
            <Heart size={19} />
            {favoriteCount > 0 && (
              <span className="absolute end-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                {favCount}
              </span>
            )}
          </Link>
          <LanguageSwitcher />
          {user ? (
            <Link
              href={`${base}/profile`}
              className="hidden rounded-full border border-border px-3 py-2 text-[13px] font-medium transition-all hover:border-primary hover:text-primary sm:flex sm:items-center sm:gap-2"
            >
              <User size={14} />
              {dict.profile.myProfile}
            </Link>
          ) : (
            <Link
              href={`${base}/auth/login`}
              className="hidden rounded-full border border-border px-4 py-2 text-[13px] font-medium transition-all hover:border-primary hover:text-primary sm:block"
            >
              {dict.auth.login}
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-full p-2.5 lg:hidden"
            aria-label={dict.nav.menu}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-border/70 bg-background px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-4 text-sm font-medium">
            <Link href={`${base}`} onClick={() => setMenuOpen(false)}>{dict.nav.discover}</Link>
            <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.browse}</Link>
            <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.categories}</Link>
            <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.artists}</Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { locale, dict } = useLocale();
  const base = `/${locale}`;

  return (
    <footer className="border-t border-border bg-[#f2efe8]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
          <div>
            <Link href={base} className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Leaf size={16} />
              </span>
              <span className="font-display text-2xl font-semibold">{dict.brandName}</span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
              {dict.footer.description}
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em]">{dict.footer.explore}</h3>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link href={`${base}/discover`} className="hover:text-foreground">{dict.discover.allDesigns}</Link>
              <Link href={`${base}/discover`} className="hover:text-foreground">{dict.nav.categories}</Link>
              <Link href={`${base}/discover`} className="hover:text-foreground">{dict.nav.artists}</Link>
              <Link href={`${base}/journal`} className="hover:text-foreground">{dict.footer.journal}</Link>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em]">{dict.footer.about}</h3>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link href={`${base}/about`} className="hover:text-foreground">{dict.footer.ourStory}</Link>
              <Link href={`${base}/become-creator`} className="hover:text-foreground">{dict.footer.sellOnMorrow}</Link>
              <Link href={`${base}/support`} className="hover:text-foreground">{dict.footer.support}</Link>
              <Link href={`${base}/terms`} className="hover:text-foreground">{dict.footer.termsPrivacy}</Link>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em]">{dict.footer.stayInspired}</h3>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              {dict.footer.newsletterDesc}
            </p>
            <div className="flex rounded-xl border border-border bg-background p-1">
              <input
                placeholder={dict.footer.emailPlaceholder}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85">
                {dict.footer.subscribe}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row">
          <span>{dict.footer.copyright}</span>
          <span>{dict.footer.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
