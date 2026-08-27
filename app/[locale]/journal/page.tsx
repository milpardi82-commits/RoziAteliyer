import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { JournalClient } from '@/features/journal/JournalClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.journal.pageTitle} — ${dict.brandName}`,
    description: dict.journal.pageDesc,
  };
}

export default function JournalPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  return <JournalClient />;
}
