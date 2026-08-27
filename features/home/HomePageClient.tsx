'use client';

/**
 * Home page interactive shell — Client Component.
 *
 * Receives server-fetched data as props. Handles:
 * - Search input state
 * - Mobile menu state
 * - Client-side favourite toggle (ephemeral, pre-auth)
 *
 * Phase 22B: Supabase/API bypass via FALLBACK_DESIGNS already applied at
 * server level. This component renders deterministically from props.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  Leaf,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import { LanguageSwitcher } from '@/components/language-switcher';
import { toPersianNumber } from '@/lib/i18n';
import { DesignCard } from '@/components/design/DesignCard';
import type { Category, Design } from '@/types/marketplace';

/** Static hero images — never depend on live API data. */
const HERO_IMAGES = {
  main:   'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
  second: 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
  third:  'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
};

const categoryVisuals: Record<string, { image: string; color: string }> = {
  floral:     { image: 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-rose-50' },
  geometric:  { image: 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-slate-100' },
  abstract:   { image: 'https://images.pexels.com/photos/2158532/pexels-photo-2158532.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-orange-50' },
  botanical:  { image: 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-emerald-50' },
  watercolor: { image: 'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-sky-50' },
  minimalist: { image: 'https://images.pexels.com/photos/2268543/pexels-photo-2268543.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', color: 'bg-stone-100' },
};

interface Props {
  initialDesigns: Design[];
  initialCategories: Category[];
}

export function HomePageClient({ initialDesigns, initialCategories }: Props) {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredDesigns = useMemo(() => {
    if (!search.trim()) return initialDesigns;
    const q = search.toLowerCase();
    return initialDesigns.filter((d) =>
      `${d.title} ${d.creators?.display_name ?? ''}`.toLowerCase().includes(q)
    );
  }, [initialDesigns, search]);

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
  }

  const favCount = isRTL ? toPersianNumber(favorites.length) : favorites.length;

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      {/* ── Header ── */}
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
              <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.discover}</Link>
              <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.categories}</Link>
              <Link href={`${base}/discover`} className="transition-colors hover:text-foreground">{dict.nav.artists}</Link>
              <Link href={`${base}/journal`} className="transition-colors hover:text-foreground">{dict.nav.journal}</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={dict.nav.search}
            >
              <Search size={19} />
            </button>
            <Link
              href={`${base}/favorites`}
              className="relative rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={dict.nav.favorites}
            >
              <Heart size={19} />
              {favorites.length > 0 && (
                <span className="absolute end-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {favCount}
                </span>
              )}
            </Link>
            <LanguageSwitcher />
            <Link href={`${base}/auth/signup`} className="hidden rounded-full border border-border px-4 py-2 text-[13px] font-medium transition-all hover:border-primary hover:text-primary sm:block">
              {dict.nav.joinCommunity}
            </Link>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-full p-2.5 lg:hidden"
              aria-label={dict.nav.menu}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="border-t border-border/70 bg-background px-5 py-4 sm:px-8">
            <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Search size={18} className="text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dict.discover.searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => { setSearch(''); setSearchOpen(false); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        {menuOpen && (
          <div className="border-t border-border/70 bg-background px-5 py-4 lg:hidden">
            <nav className="flex flex-col gap-4 text-sm font-medium">
              <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.discover}</Link>
              <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.categories}</Link>
              <Link href={`${base}/discover`} onClick={() => setMenuOpen(false)}>{dict.nav.artists}</Link>
              <Link href={`${base}/journal`} onClick={() => setMenuOpen(false)}>{dict.nav.journal}</Link>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section style={{ background: '#f5f0e8', position: 'relative', overflow: 'hidden', borderBottom: '1px solid hsl(var(--border) / 0.6)' }}>
        {/* decorative purple circle */}
        <div style={{ position: 'absolute', right: '30%', top: '8%', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(124,92,216,0.18)', pointerEvents: 'none' }} />
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12" style={{ display: 'flex', alignItems: 'center', minHeight: '560px', paddingTop: '5rem', paddingBottom: '5rem', gap: '2.5rem', flexWrap: 'wrap' }}>

          {/* ── Text column ── */}
          <div style={{ flex: '1 1 380px', maxWidth: '520px', position: 'relative', zIndex: 10, direction: 'ltr', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c07f3a', marginBottom: '1.25rem' }}>
              {dict.hero.badge}
            </p>
            <h1 style={{ fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#1a1a1a', margin: 0 }}>
              <span style={{ display: 'block', fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}>{dict.hero.titleLine1}</span>
              <span style={{ display: 'block', fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}>{dict.hero.titleLine2}</span>
              <span style={{ display: 'block', fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontStyle: 'italic', color: '#7c5cd8' }}>{dict.hero.titleLine3}</span>
            </h1>
            <p style={{ marginTop: '1.5rem', fontSize: '15px', lineHeight: 1.75, color: '#666', maxWidth: '380px' }}>
              {dict.hero.subtitle}
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link
                href={`${base}/discover`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px', background: '#1a1a1a', color: '#fff', padding: '12px 24px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
              >
                {dict.hero.exploreCta}
              </Link>
              <Link
                href={`${base}/become-creator`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', color: '#1a1a1a', padding: '12px 24px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
              >
                {dict.hero.joinArtist}
              </Link>
            </div>
          </div>

          {/* ── Cards column ── */}
          <div className="hidden lg:block" style={{ flex: '1 1 420px', position: 'relative', height: '480px' }}>
            {/* back card — leftmost */}
            <div style={{ position: 'absolute', left: '0%', top: '14%', width: '210px', height: '290px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', transform: 'rotate(-12deg)' }}>
              <img src={initialDesigns[1]?.image_url ?? HERO_IMAGES.second} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* middle card */}
            <div style={{ position: 'absolute', left: '22%', top: '4%', width: '240px', height: '330px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', transform: 'rotate(-4deg)' }}>
              <img src={initialDesigns[0]?.image_url ?? HERO_IMAGES.main} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* front card — rightmost */}
            <div style={{ position: 'absolute', right: '0%', top: '8%', width: '255px', height: '350px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', transform: 'rotate(6deg)' }}>
              <img src={initialDesigns[2]?.image_url ?? HERO_IMAGES.third} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

        </div>
      </section>

      {/* ── Featured Designs ── */}
      <section id="discover" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-10 flex items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.sections.curatedForYou}</p>
            <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{dict.sections.freshFromStudio}</h2>
          </div>
          <Link href={`${base}/discover`} className="group hidden items-center gap-2 pb-1 text-sm font-semibold text-primary sm:flex">
            {dict.sections.viewAllDesigns}
            {isRTL
              ? <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1 rotate-180" />
              : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            }
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {filteredDesigns.slice(0, 4).map((design, index) => (
            <DesignCard
              key={design.id}
              design={design}
              isFavorite={favorites.includes(design.id)}
              onFavorite={toggleFavorite}
              priority={index < 2}
              base={base}
            />
          ))}
        </div>
      </section>

      {/* ── Categories ── */}
      <section id="categories" className="border-y border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.sections.exploreByMood}</p>
              <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{dict.sections.whatDrawnTo}</h2>
            </div>
            <Link href={`${base}/discover`} className="hidden items-center gap-2 text-sm font-semibold text-primary sm:flex">
              {dict.sections.browseEverything}
              {isRTL ? <ChevronRight size={16} className="rotate-180" /> : <ChevronRight size={16} />}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {initialCategories.slice(0, 6).map((category) => {
              const visual = categoryVisuals[category.slug] ?? categoryVisuals.abstract;
              const count = isRTL ? toPersianNumber(category.design_count) : category.design_count;
              return (
                <Link
                  href={`${base}/discover?category=${category.slug}`}
                  key={category.id}
                  className="group relative aspect-[0.82] overflow-hidden rounded-2xl"
                >
                  <img src={visual.image} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <span className="block font-display text-xl sm:text-2xl">{category.name}</span>
                    <span className="mt-1 block text-[11px] text-white/75">{count} {dict.discover.designsUnit}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Artists ── */}
      <section id="artists" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.sections.peopleBehind}</p>
            <h2 className="font-display text-4xl font-medium leading-tight tracking-[-0.045em] sm:text-5xl">
              {dict.sections.madeWithIntention}<br />
              <span className="italic text-muted-foreground">{dict.sections.sharedWithWorld}</span>
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-7 text-muted-foreground">{dict.sections.peopleBehindDesc}</p>
            <Link href={`${base}/discover`} className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              {dict.sections.meetAllArtists}
              {isRTL
                ? <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1 rotate-180" />
                : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              }
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <CreatorSpotlight image="https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=600&h=750&fit=crop" name="Elena Marchetti" location="Milan, Italy" base={base} handle="elena-marchetti" />
            <CreatorSpotlight image="https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=600&h=750&fit=crop" name="Kenji Watanabe" location="Tokyo, Japan" offset base={base} handle="kenji-watanabe" />
            <CreatorSpotlight image="https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=600&h=750&fit=crop" name="Amara Okafor" location="Lagos, Nigeria" base={base} handle="amara-okafor" />
          </div>
        </div>
      </section>

      {/* ── Journal CTA ── */}
      <section id="journal" className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_auto] lg:px-12 lg:py-20">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground/70">{dict.sections.creativelyCurious}</p>
            <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{dict.sections.journalTitle}</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-primary-foreground/75">{dict.sections.journalDesc}</p>
          </div>
          <Link href={`${base}/journal`} className="group inline-flex w-fit items-center gap-3 rounded-full bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5">
            {dict.sections.readJournal}
            {isRTL
              ? <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1 rotate-180" />
              : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            }
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="join" className="border-t border-border bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
            <div>
              <Link href={base} className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Leaf size={16} /></span>
                <span className="font-display text-2xl font-semibold">{dict.brandName}</span>
              </Link>
              <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">{dict.footer.description}</p>
            </div>
            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em]">{dict.footer.explore}</h3>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <Link href={`${base}/discover`} className="hover:text-foreground">{dict.discover.allDesigns}</Link>
                <Link href={`${base}/discover`} className="hover:text-foreground">{dict.nav.categories}</Link>
                <Link href={`${base}/discover`} className="hover:text-foreground">{dict.nav.artists}</Link>
                <Link href={`${base}/journal`} className="hover:text-foreground">{dict.nav.journal}</Link>
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
              <p className="mb-4 text-sm leading-6 text-muted-foreground">{dict.footer.newsletterDesc}</p>
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
    </main>
  );
}

function CreatorSpotlight({ image, name, location, offset, base, handle }: {
  image: string; name: string; location: string; offset?: boolean; base: string; handle: string;
}) {
  return (
    <Link href={`${base}/artists/${handle}`} className={`group ${offset ? 'mt-8' : ''}`}>
      <div className="aspect-[0.78] overflow-hidden rounded-2xl bg-muted">
        <img src={image} alt={name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="mt-3">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {name}
          <Check size={13} className="rounded-full bg-primary p-0.5 text-primary-foreground" />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{location}</span>
      </div>
    </Link>
  );
}
