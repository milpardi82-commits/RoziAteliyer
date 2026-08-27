import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { TermsClient } from '@/features/terms/TermsClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.terms.pageTitle} — ${dict.brandName}`,
    description: dict.terms.section1Content,
  };
}

export default function TermsPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  return <TermsClient />;
}
