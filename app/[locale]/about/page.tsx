import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { AboutClient } from '@/features/about/AboutClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.about.pageTitle} — ${dict.brandName}`,
    description: dict.about.missionDesc,
  };
}

export default function AboutPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  return <AboutClient />;
}
