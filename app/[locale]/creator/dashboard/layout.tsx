/**
 * Creator Dashboard layout — Phase 6.
 *
 * Wraps all dashboard sub-routes with:
 * - The site header (consistent with the rest of the app)
 * - A dashboard-specific page header band
 * - The dashboard tab navigation
 * - Site footer
 *
 * Authentication is enforced at two layers:
 * 1. Middleware redirects unauthenticated users to /auth/login.
 * 2. This layout re-validates the session and renders the appropriate
 *    access gate for non-creators, pending creators, and suspended creators.
 *
 * Creator identity is resolved server-side and passed down via props.
 * No creator-identity data travels through client state.
 */
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator } from '@/services/dashboard.service';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { DashboardNav } from '@/features/creator/dashboard/DashboardNav';
import {
  NotCreatorGate,
  PendingCreatorGate,
  SuspendedCreatorGate,
} from '@/features/creator/dashboard/DashboardGates';

interface Props {
  children: React.ReactNode;
  params: { locale: string };
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.dashboard.pageTitle} — ${dict.brandName}`,
    robots: { index: false, follow: false }, // Dashboard is private
  };
}

export default async function DashboardLayout({ children, params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);
  const d      = dict.dashboard;

  // Layer 1: auth guard (middleware already handles redirect; this is belt-and-suspenders)
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard`);
  }

  // Layer 2: creator identity resolution
  // getDashboardCreator() returns any status (approved/pending/suspended)
  const creator = await getDashboardCreator();

  // Layer 3: creator status gates
  // Renders inline access gates — no redirects, preserves URL
  const gateContent = (() => {
    if (!creator)                       return <NotCreatorGate locale={locale} dict={dict} />;
    if (creator.status === 'pending')   return <PendingCreatorGate dict={dict} />;
    if (creator.status === 'suspended') return <SuspendedCreatorGate dict={dict} />;
    return null; // approved — show dashboard
  })();

  const showDashboard = gateContent === null;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Dashboard page header band — consistent with rest of app */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {d.pageBadge}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
            {d.pageTitle}
          </h1>
        </div>
      </section>

      {/* Dashboard shell */}
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        {showDashboard ? (
          <>
            {/* Tab navigation */}
            <div className="mt-6">
              <DashboardNav locale={locale} />
            </div>

            {/* Dashboard content area */}
            <div className="py-8">
              {children}
            </div>
          </>
        ) : (
          /* Access gate — no nav shown */
          gateContent
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
