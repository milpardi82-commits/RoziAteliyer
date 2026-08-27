import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { SupportClient } from '@/features/support/SupportClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.support.pageTitle} — ${dict.brandName}`,
    description: dict.support.pageDesc,
  };
}

export default function SupportPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  return <SupportClient />;
}
