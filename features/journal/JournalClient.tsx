'use client';

/**
 * Journal page — Client Component.
 * Presents a curated editorial feed for Rozi Atelier.
 * Uses static articles — no backend dependency.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';

// ── Static article data ───────────────────────────────────────────────────────

const ARTICLES = [
  {
    slug: 'a1',
    titleFa: 'از استودیوی کنجی واتانابه: هنر الگوهای آساناها',
    titleEn: 'Studio Visit: Kenji Watanabe and the art of Asanoha patterns',
    excerptFa: 'در این بازدید از استودیو، با کنجی صحبت کردیم درباره اینکه چطور یک هنر سنتی ژاپنی را با زبان معاصر طراحی سطح تلفیق می‌کند.',
    excerptEn: 'In this studio visit, we spoke with Kenji about how he blends traditional Japanese craft with contemporary surface design language.',
    img: 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'بازدید از استودیو',
    categoryEn: 'Studio Visit',
    minReadFa: '۷',
    minReadEn: '7',
    featured: true,
  },
  {
    slug: 'a2',
    titleFa: 'چطور الگوی درست را برای فضای زندگی‌تان پیدا کنید',
    titleEn: 'How to find the right pattern for your living space',
    excerptFa: 'از رنگ‌بندی گرفته تا مقیاس الگو، راهنمایی ساده برای انتخاب طراحی‌هایی که با محیط شما هماهنگ باشند.',
    excerptEn: 'From colour palette to pattern scale, a simple guide to choosing designs that harmonise with your environment.',
    img: 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'آموزش',
    categoryEn: 'How-to',
    minReadFa: '۵',
    minReadEn: '5',
    featured: false,
  },
  {
    slug: 'a3',
    titleFa: 'الهام از طبیعت: بوتانیکال در طراحی مدرن',
    titleEn: 'Nature as inspiration: Botanicals in modern design',
    excerptFa: 'طراحان مستقل از سراسر جهان توضیح می‌دهند که چطور طبیعت بی‌واسطه‌ترین منبع الهام‌شان است.',
    excerptEn: 'Independent designers from around the world explain how nature remains their most immediate source of inspiration.',
    img: 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'الهام',
    categoryEn: 'Inspiration',
    minReadFa: '۶',
    minReadEn: '6',
    featured: false,
  },
  {
    slug: 'a4',
    titleFa: 'آمارا اوکافور: طراحی هویت از لاگوس تا دنیا',
    titleEn: 'Amara Okafor: Designing identity from Lagos to the world',
    excerptFa: 'آمارا درباره اینکه چطور فرهنگ نیجریایی در آثارش زندگی می‌کند و چرا طراحی اصیل مهم‌تر از همیشه است صحبت می‌کند.',
    excerptEn: 'Amara talks about how Nigerian culture lives in her work and why authentic design matters more than ever.',
    img: 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'بازدید از استودیو',
    categoryEn: 'Studio Visit',
    minReadFa: '۸',
    minReadEn: '8',
    featured: false,
  },
  {
    slug: 'a5',
    titleFa: 'فرآیند: از ایده تا طراحی آماده برای فروش',
    titleEn: 'The process: from idea to a market-ready design',
    excerptFa: 'مرحله به مرحله با یک هنرمند مستقل همراه می‌شویم که توضیح می‌دهد چطور یک طراحی سطح را از لحظه الهام تا آپلود نهایی می‌برد.',
    excerptEn: 'Step by step with an independent artist who walks us through taking a surface design from initial inspiration to final upload.',
    img: 'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'فرآیند',
    categoryEn: 'Process',
    minReadFa: '۱۰',
    minReadEn: '10',
    featured: false,
  },
  {
    slug: 'a6',
    titleFa: 'جامعه رُزی آتلیه: یک سال با هنرمندان مستقل',
    titleEn: 'The Rozi Atelier community: one year with independent artists',
    excerptFa: 'یک سال گذشت. جشن می‌گیریم و با هنرمندانی که این جامعه را ساختند صحبت می‌کنیم.',
    excerptEn: 'One year in. We celebrate and speak with the artists who built this community.',
    img: 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
    categoryFa: 'جامعه',
    categoryEn: 'Community',
    minReadFa: '۴',
    minReadEn: '4',
    featured: false,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function JournalClient() {
  const { locale, dict, isRTL } = useLocale();
  const j = dict.journal;
  const base = `/${locale}`;

  const featured = ARTICLES.find((a) => a.featured)!;
  const rest = ARTICLES.filter((a) => !a.featured);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* ── Page header ── */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{j.pageBadge}</p>
          <h1 className="font-display text-[clamp(2.8rem,6vw,5rem)] font-medium leading-tight tracking-[-0.045em]">
            {j.pageTitle}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{j.pageDesc}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        {/* ── Featured article ── */}
        <div className="mb-16">
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{j.featuredBadge}</p>
          <Link href={`${base}/journal`} className="group grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={featured.img}
                alt={isRTL ? featured.titleFa : featured.titleEn}
                className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div>
              <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                {isRTL ? featured.categoryFa : featured.categoryEn}
              </span>
              <h2 className="font-display text-3xl font-medium leading-snug tracking-[-0.04em] group-hover:text-primary transition-colors sm:text-4xl">
                {isRTL ? featured.titleFa : featured.titleEn}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {isRTL ? featured.excerptFa : featured.excerptEn}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {j.readMore}
                {isRTL
                  ? <ArrowRight size={15} className="rotate-180 transition-transform group-hover:-translate-x-1" />
                  : <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                }
              </span>
            </div>
          </Link>
        </div>

        {/* ── All articles ── */}
        <div>
          <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{j.allArticlesBadge}</p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <Link
                key={article.slug}
                href={`${base}/journal`}
                className="group rounded-2xl border border-border overflow-hidden bg-card transition-shadow hover:shadow-md"
              >
                <div className="overflow-hidden">
                  <img
                    src={article.img}
                    alt={isRTL ? article.titleFa : article.titleEn}
                    className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    {isRTL ? article.categoryFa : article.categoryEn}
                  </span>
                  <h3 className="mt-1 font-display text-lg font-medium leading-snug tracking-[-0.03em] group-hover:text-primary transition-colors">
                    {isRTL ? article.titleFa : article.titleEn}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">
                    {isRTL ? article.excerptFa : article.excerptEn}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {isRTL ? article.minReadFa : article.minReadEn} {j.minRead}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
