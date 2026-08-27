'use client';

/**
 * Become a Creator — client component.
 *
 * Handles four UI states:
 *  1. unauthenticated → login CTA
 *  2. already an approved creator → link to their profile
 *  3. pending application → waiting state
 *  4. open → application form
 *
 * Form submission uses the browser Supabase client (supabaseAuthClient).
 * The user's RLS-enforced session ensures they can only insert their own row.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Clock, Globe, Palette, Users } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';
import type { Creator } from '@/types/marketplace';
import type { CreatorApplication } from '@/types/creator';
import type { Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  user: { id: string; email: string | null } | null;
  existingCreator: Creator | null;
  existingApplication: CreatorApplication | null;
}

// ─── Why become a creator — static reason cards ──────────────────────────────

function ReasonCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[#f7f6f2] p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BecomeCreatorClient({ locale, user, existingCreator, existingApplication }: Props) {
  const { dict } = useLocale();
  const router = useRouter();
  const c = dict.creator;

  // Form state
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Derived field errors ──────────────────────────────────────────────────
  function validateHandle(v: string): string {
    if (!v.trim()) return c.handleRequired;
    if (!/^[a-z0-9-]+$/.test(v)) return c.handleInvalid;
    return '';
  }
  function validateMessage(v: string): string {
    if (!v.trim()) return c.messageRequired;
    if (v.trim().length < 50) return c.messageTooShort;
    return '';
  }

  // ── Form submission ───────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const handleErr = validateHandle(handle);
    const messageErr = validateMessage(message);
    if (handleErr || messageErr) {
      setFormError(handleErr || messageErr);
      return;
    }

    setSubmitting(true);
    const supabase = supabaseAuthClient();
    const { error } = await supabase.from('creator_applications').insert({
      user_id: user!.id,
      status: 'pending',
      message: message.trim(),
      desired_handle: handle.trim().toLowerCase(),
      desired_display_name: displayName.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        setFormError(c.errorAlreadyPending);
      } else {
        setFormError(c.errorGeneric);
      }
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  const base = `/${locale}`;

  // ── State: already an approved creator ───────────────────────────────────
  if (existingCreator) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <section className="border-b border-border/60 bg-[#f2efe8]">
          <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{c.pageBadge}</p>
            <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{c.pageTitle}</h1>
          </div>
        </section>
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="mb-3 font-display text-2xl font-medium">{c.alreadyCreator}</h2>
            <Link
              href={`${base}/artists/${existingCreator.handle}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {c.viewProfile}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // ── State: pending application (server-resolved or just submitted) ────────
  const showPending = existingApplication?.status === 'pending' || submitted;
  if (showPending) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <section className="border-b border-border/60 bg-[#f2efe8]">
          <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{c.pageBadge}</p>
            <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{c.pageTitle}</h1>
          </div>
        </section>
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600 mx-auto">
              <Clock size={32} />
            </div>
            <h2 className="mb-3 font-display text-2xl font-medium">
              {submitted ? c.successTitle : c.pendingTitle}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {submitted ? c.successMessage : c.pendingMessage}
            </p>
            <Link
              href={base}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              {locale === 'fa' ? 'بازگشت به صفحه اصلی' : 'Back to home'}
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // ── State: not authenticated ──────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <PageHeader badge={c.pageBadge} title={c.pageTitle} />
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-md text-center">
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{c.loginRequired}</p>
            <Link
              href={`${base}/auth/login?next=${base}/become-creator`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {c.loginCta}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // ── State: open application form ──────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Page header band */}
      <PageHeader badge={c.pageBadge} title={c.pageTitle} />

      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[1fr_420px]">

          {/* Left — value proposition */}
          <div>
            <h2 className="font-display text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              {c.headline}
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              {c.subheadline}
            </p>

            <h3 className="mt-12 mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {c.whyTitle}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <ReasonCard icon={Globe}    title={c.reason1Title} desc={c.reason1Desc} />
              <ReasonCard icon={Palette}  title={c.reason2Title} desc={c.reason2Desc} />
              <ReasonCard icon={Users}    title={c.reason3Title} desc={c.reason3Desc} />
            </div>
          </div>

          {/* Right — application form */}
          <div className="rounded-2xl border border-border bg-background p-7 shadow-sm">
            <h2 className="mb-6 font-display text-xl font-semibold">{c.formTitle}</h2>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Desired handle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="handle">
                  {c.desiredHandle}
                  <span className="ms-1 text-destructive">*</span>
                </label>
                <input
                  id="handle"
                  type="text"
                  dir="ltr"
                  required
                  value={handle}
                  placeholder={c.desiredHandlePlaceholder}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="mt-1 text-xs text-muted-foreground">{c.desiredHandleHint}</p>
              </div>

              {/* Desired display name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="displayName">
                  {c.desiredDisplayName}
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  placeholder={c.desiredDisplayNamePlaceholder}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Message / motivation */}
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="message">
                  {c.message}
                  <span className="ms-1 text-destructive">*</span>
                </label>
                <textarea
                  id="message"
                  rows={5}
                  required
                  value={message}
                  placeholder={c.messagePlaceholder}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {message.trim().length} / 50+ {c.messageHint}
                </p>
              </div>

              {/* Error */}
              {formError && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? c.submitting : c.submit}
                {!submitting && <ArrowRight size={15} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

// ─── Small sub-component: page header band ────────────────────────────────────

function PageHeader({ badge, title }: { badge: string; title: string }) {
  return (
    <section className="border-b border-border/60 bg-[#f2efe8]">
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{badge}</p>
        <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{title}</h1>
      </div>
    </section>
  );
}
