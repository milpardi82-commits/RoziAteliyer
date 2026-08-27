/**
 * Creator Dashboard — Creator Profile page.
 *
 * Displays and allows editing of the authenticated creator's public profile.
 * All editable fields are defined in CreatorProfileUpdate and match existing
 * columns in the `creators` table.
 *
 * Route: /[locale]/creator/dashboard/profile
 */
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator } from '@/services/dashboard.service';
import { DashboardProfileForm } from '@/features/creator/dashboard/DashboardProfileForm';

interface Props {
  params: { locale: string };
}

export default async function DashboardProfilePage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // Auth guard
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/profile`);
  }

  // Resolve creator — only approved creators can edit their profile here
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') return null;

  return (
    <div className="max-w-lg">
      <DashboardProfileForm creator={creator} locale={locale} />
    </div>
  );
}
