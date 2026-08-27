/**
 * Discover page — Server Component shell.
 *
 * Provides the initial category list and first page of designs from the server.
 * All client-side filtering, sorting, and search is handled by DiscoverClient.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getFeaturedDesigns, getCategories } from '@/services';
import { DiscoverClient } from '@/features/discover/DiscoverClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const locale = params.locale as Locale;
  return {
    title: locale === 'fa' ? 'کاشف طراحی‌ها — رُزی آتلیه' : 'Discover Designs — Rozi Atelier',
    description: locale === 'fa'
      ? 'طراحی‌های اصلی سطح را بر اساس دسته‌بندی، هنرمند و سبک مرور کنید.'
      : 'Browse original surface designs by category, artist, and style.',
  };
}

export default async function DiscoverPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  const [initialDesigns, categories] = await Promise.all([
    getFeaturedDesigns(48),
    getCategories(),
  ]);

  return <DiscoverClient initialDesigns={initialDesigns} categories={categories} />;
}
