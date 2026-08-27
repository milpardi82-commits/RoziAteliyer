import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getUserProfile } from '@/services/user-profile.service';
import { ProfileClient } from '@/features/auth/ProfileClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  return {
    title: params.locale === 'fa' ? 'پروفایل — رُزی آتلیه' : 'Profile — Rozi Atelier',
  };
}

export default async function ProfilePage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;

  // Auth guard — redirect to login if not authenticated
  const user = await getServerUser();
  if (!user) redirect(`/${locale}/auth/login?next=/${locale}/profile`);

  // Fetch profile — the trigger should have created it on signup
  const profile = await getUserProfile(user.id);
  if (!profile) {
    // Safety net: profile didn't auto-create (e.g. trigger not yet deployed)
    redirect(`/${locale}/auth/login`);
  }

  return <ProfileClient profile={profile} email={user.email ?? ''} />;
}
