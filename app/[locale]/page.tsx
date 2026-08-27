/**
 * Home page — Server Component.
 *
 * Data fetching happens on the server (no client-side useEffect).
 * The interactive shell (header, favourite toggles) is delegated to
 * HomePageClient which is a Client Component.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getFeaturedDesigns, getCategories } from '@/services';
import { HomePageClient } from '@/features/home/HomePageClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const locale = params.locale as Locale;
  return {
    title: locale === 'fa'
      ? 'رُزی آتلیه — آتلیه‌ای برای طراحی اصیل'
      : 'Rozi Atelier — An atelier for original surface design',
    description: locale === 'fa'
      ? 'طراحی‌های اصلی سطح را از هنرمندان مستقل سراسر جهان کشف کنید.'
      : 'Discover original surface designs from independent artists around the world.',
  };
}

export default async function HomePage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  const [designs, categories] = await Promise.all([
    getFeaturedDesigns(12),
    getCategories(),
  ]);

  return <HomePageClient initialDesigns={designs} initialCategories={categories} />;
}
