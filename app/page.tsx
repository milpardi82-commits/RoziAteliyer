/**
 * Root page — redirects to the default locale.
 * The middleware handles locale detection and redirection,
 * but this is a safety fallback if middleware is bypassed.
 */
import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n';

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
