/**
 * Creator Dashboard — Edit Design page.
 *
 * Route: /[locale]/creator/dashboard/designs/[id]/edit
 *
 * Security layers:
 *   1. Middleware redirects unauthenticated users to /auth/login
 *   2. Dashboard layout gates non-creator and non-approved users
 *   3. This page re-validates: only the owning creator can see the editor
 *   4. getDesignEditorData() enforces RLS — cross-creator access returns null
 *
 * Editable statuses: draft, pending_review
 * Non-editable statuses: approved, published, archived → redirect to dashboard
 */
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator } from '@/services/dashboard.service';
import { getDesignEditorData } from '@/services/design-creation.service';
import { DesignForm } from '@/features/creator/design-editor/DesignForm';

interface Props {
  params: { locale: string; id: string };
}

export default async function EditDesignPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // ── Auth guard ────────────────────────────────────────────────────────────
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/designs/${params.id}/edit`);
  }

  // ── Creator guard ─────────────────────────────────────────────────────────
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') {
    redirect(`/${locale}/creator/dashboard`);
  }

  // ── Fetch design + editor data ────────────────────────────────────────────
  // getDesignEditorData() uses RLS (read_own_designs) — a design not owned
  // by the session creator will return null and 404 below.
  const editorData = await getDesignEditorData(params.id);
  if (!editorData) {
    notFound();
  }

  // Guard: only editable-status designs should show this form
  const { design } = editorData;
  if (design && !['draft', 'pending_review'].includes(design.status ?? '')) {
    // Design is published/approved/archived — not editable
    redirect(`/${locale}/creator/dashboard/designs`);
  }

  const d        = dict.dashboard;
  const de       = d.designEditor;
  const backHref = `/${locale}/creator/dashboard/designs`;

  return (
    <DesignForm
      mode="edit"
      editorData={editorData}
      locale={locale}
      backHref={backHref}
      labels={de}
    />
  );
}
