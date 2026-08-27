'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Download, Eye, Heart, MessageCircle, Palette, Share2, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Creator, Design, Review } from '@/lib/types';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';

export default function DesignDetailPage() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const params = useParams();
  const slug = params.slug as string;

  const [design, setDesign] = useState<Design | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [moreDesigns, setMoreDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    async function loadDesign() {
      const { data } = await supabase
        .from('designs')
        .select('*, creators(*), shops(*)')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        setDesign(data as Design);
        const creatorId = (data as Design).creator_id;

        const [reviewsRes, moreRes] = await Promise.all([
          supabase
            .from('reviews')
            .select('*, creators(*)')
            .eq('design_id', (data as Design).id)
            .order('created_at', { ascending: false }),
          supabase
            .from('designs')
            .select('*, creators(*)')
            .eq('creator_id', creatorId)
            .neq('id', (data as Design).id)
            .eq('is_public', true)
            .limit(4),
        ]);
        if (reviewsRes.data) setReviews(reviewsRes.data as Review[]);
        if (moreRes.data) setMoreDesigns(moreRes.data as Design[]);
      }
      setLoading(false);
    }
    if (slug) loadDesign();
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="aspect-square skeleton-shimmer rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 w-2/3 skeleton-shimmer rounded" />
              <div className="h-4 w-1/3 skeleton-shimmer rounded" />
              <div className="h-24 skeleton-shimmer rounded" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!design) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-2xl font-semibold">{dict.detail.notFound}</p>
          <Link href={`${base}/discover`} className="mt-4 text-sm font-semibold text-primary">
            {dict.discover.allDesigns}
          </Link>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const creator = design.creators;
  const ratingStars = Math.round(design.avg_rating);
  const localeCode = isRTL ? 'fa-IR' : 'en-US';

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={isFavorite ? 1 : 0} />

      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12">
        <Link href={`${base}/discover`} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          {isRTL ? <ArrowLeft size={16} className="rotate-180" /> : <ArrowLeft size={16} />} {dict.detail.backToBrowse}
        </Link>
      </div>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <img src={design.image_url} alt={design.title} className="h-full w-full object-cover" />
              {design.is_featured && (
                <span className="absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] backdrop-blur">
                  {dict.design.featured}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                <Eye size={16} className="text-muted-foreground" />
                <span className="font-semibold">{isRTL ? toPersianNumber(design.view_count.toLocaleString()) : design.view_count.toLocaleString()}</span>
                <span className="text-muted-foreground">{dict.detail.views}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                <Heart size={16} className="text-muted-foreground" />
                <span className="font-semibold">{isRTL ? toPersianNumber(design.favorite_count) : design.favorite_count}</span>
                <span className="text-muted-foreground">{dict.detail.favoritesCount}</span>
              </div>
              <button className="ms-auto grid h-10 w-10 place-items-center rounded-xl border border-border transition-colors hover:bg-muted">
                <Share2 size={17} />
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="mb-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  className={i < ratingStars ? 'text-accent' : 'text-border'}
                  fill="currentColor"
                />
              ))}
              <span className="ms-2 text-sm text-muted-foreground">
                {isRTL ? toPersianNumber(design.avg_rating.toFixed(1)) : design.avg_rating.toFixed(1)} ({isRTL ? toPersianNumber(design.review_count) : design.review_count} {dict.detail.reviews})
              </span>
            </div>

            <h1 className="font-display text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
              {design.title}
            </h1>

            {creator && (
              <Link href={`${base}/artists/${creator.handle}`} className="mt-5 flex items-center gap-3 group">
                <span className="h-11 w-11 overflow-hidden rounded-full bg-muted">
                  {creator.avatar_url && (
                    <img src={creator.avatar_url} alt={creator.display_name} className="h-full w-full object-cover" />
                  )}
                </span>
                <div>
                  <span className="flex items-center gap-1 text-sm font-semibold group-hover:text-primary">
                    {creator.display_name}
                    {creator.is_verified && (
                      <Check size={14} className="rounded-full bg-primary p-0.5 text-primary-foreground" />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{creator.location}</span>
                </div>
              </Link>
            )}

            {design.description && (
              <p className="mt-6 text-[15px] leading-7 text-muted-foreground">{design.description}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {design.colors.map((color) => (
                <div key={color} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium">{color}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-xs text-muted-foreground">{dict.detail.dimensions}</p>
                <p className="mt-1 text-sm font-semibold">{isRTL ? toPersianNumber(design.width_px) : design.width_px} × {isRTL ? toPersianNumber(design.height_px) : design.height_px}px</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{dict.detail.resolution}</p>
                <p className="mt-1 text-sm font-semibold">{isRTL ? toPersianNumber(design.dpi) : design.dpi} DPI</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{dict.detail.published}</p>
                <p className="mt-1 text-sm font-semibold">
                  {design.published_at
                    ? new Date(design.published_at).toLocaleDateString(localeCode, { month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsFavorite((f) => !f)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-all ${
                  isFavorite
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-border hover:border-primary hover:text-primary'
                }`}
              >
                <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
                {isFavorite ? dict.detail.favorited : dict.design.addToFavorites}
              </button>
              <button className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5">
                <Download size={17} /> {dict.detail.getDesign}
              </button>
            </div>
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_2fr]">
            <div>
              <h2 className="font-display text-3xl font-medium tracking-[-0.04em]">{dict.detail.communityReviews}</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold">{isRTL ? toPersianNumber(design.avg_rating.toFixed(1)) : design.avg_rating.toFixed(1)}</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18} className={i < ratingStars ? 'text-accent' : 'text-border'} fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{isRTL ? toPersianNumber(design.review_count) : design.review_count} {dict.detail.totalReviews}</p>
            </div>
            <div className="space-y-5">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                      {review.creators?.avatar_url && (
                        <img src={review.creators.avatar_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{review.creators?.display_name ?? (isRTL ? 'ناشناس' : 'Anonymous')}</p>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < review.rating ? 'text-accent' : 'text-border'} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString(localeCode, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {review.comment && <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {moreDesigns.length > 0 && creator && (
        <section className="border-t border-border/60 bg-[#f2efe8]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.detail.moreFromArtist}</p>
                <h2 className="font-display text-3xl font-medium tracking-[-0.04em]">{creator.display_name}</h2>
              </div>
              <Link href={`${base}/artists/${creator.handle}`} className="flex items-center gap-2 text-sm font-semibold text-primary">
                {dict.detail.viewProfile} {isRTL ? <ArrowLeft size={15} className="rotate-180" /> : <ArrowLeft size={15} className="rotate-180" />}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 lg:gap-x-6">
              {moreDesigns.map((d) => (
                <Link key={d.id} href={`${base}/designs/${d.slug}`} className="group min-w-0">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                    <img src={d.image_url} alt={d.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold transition-colors group-hover:text-primary">{d.title}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Star size={11} fill="currentColor" className="text-accent" /> {isRTL ? toPersianNumber(d.avg_rating.toFixed(1)) : d.avg_rating.toFixed(1)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
