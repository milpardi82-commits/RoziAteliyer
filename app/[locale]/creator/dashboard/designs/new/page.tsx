/**
 * Creator Dashboard — New Design page.
 *
 * Route: /[locale]/creator/dashboard/designs/new
 *
 * Security layers:
 *   1. Middleware redirects unauthenticated users to /auth/login
 *   2. Dashboard layout gates non-creator and non-approved users
 *   3. This page adds an additional creator-only check
 *
 * This page renders the DesignForm in 'create' mode with fresh editor data.
 * No design exists yet — the form creates it on first save.
 */
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator } from '@/services/dashboard.service';
import { getDesignEditorData } from '@/services/design-creation.service';
import { DesignForm } from '@/features/creator/design-editor/DesignForm';

interface Props {
  params: { locale: string };
}

export default async function NewDesignPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // ── Auth guard ────────────────────────────────────────────────────────────
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/designs/new`);
  }

  // ── Creator guard — only approved creators ───────────────────────────────
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') {
    redirect(`/${locale}/creator/dashboard`);
  }

  // ── Fetch editor data (categories, tags; no design yet) ──────────────────
  const editorData = await getDesignEditorData();
  // getDesignEditorData() without an ID always returns the empty-design bundle
  if (!editorData) {
    // Should not happen, but belt-and-suspenders
    redirect(`/${locale}/creator/dashboard/designs`);
  }

  const d        = dict.dashboard;
  const de       = d.designEditor;
  const backHref = `/${locale}/creator/dashboard/designs`;

  return (
    <DesignForm
      mode="create"
      editorData={editorData}
      locale={locale}
      backHref={backHref}
      labels={de}
    />
  );
}
