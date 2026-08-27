import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { LoginForm } from '@/features/auth/LoginForm';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  return {
    title: params.locale === 'fa' ? 'ورود — رُزی آتلیه' : 'Sign in — Rozi Atelier',
  };
}

export default async function LoginPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  // If already logged in, redirect to profile
  const user = await getServerUser();
  if (user) redirect(`/${params.locale}/profile`);

  return <LoginForm />;
}
