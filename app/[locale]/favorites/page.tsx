/**
 * Favorites page — Server Component shell.
 *
 * Favorites are stored client-side (no auth yet), so the real work happens
 * in FavoritesClient. The server renders the shell for fast initial paint.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { FavoritesClient } from '@/features/favorites/FavoritesClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const locale = params.locale as Locale;
  return {
    title: locale === 'fa' ? 'علاقه‌مندی‌ها — رُزی آتلیه' : 'Favorites — Rozi Atelier',
  };
}

export default function FavoritesPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  return <FavoritesClient />;
}
