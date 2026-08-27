'use client';

/**
 * Profile page client component.
 *
 * Displays and allows editing of the authenticated user's profile.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Save, User } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';
import type { UserProfile } from '@/types/auth';

interface Props {
  profile: UserProfile;
  email: string;
}

export function ProfileClient({ profile, email }: Props) {
  const { locale, dict } = useLocale();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [languagePreference, setLanguagePreference] = useState<'fa' | 'en'>(
    profile.language_preference ?? locale
  );
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const supabase = supabaseAuthClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        language_preference: languagePreference,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      setErrorMsg(dict.profile.updateError);
    } else {
      setSuccessMsg(dict.profile.profileUpdated);
      router.refresh();
    }
  }

  async function handleLogout() {
    const supabase = supabaseAuthClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString(
    locale === 'fa' ? 'fa-IR' : 'en-US',
    { year: 'numeric', month: 'long' }
  );

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Header band — same style as favorites/discover */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {dict.profile.myProfile}
          </p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              {dict.profile.title}
            </h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <LogOut size={15} />
              {dict.auth.logout}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {email} · {dict.profile.memberSince} {memberSince}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-lg">
          {/* Avatar placeholder */}
          <div className="mb-8 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User size={28} />
              )}
            </div>
            <div>
              <p className="font-semibold">{displayName || email}</p>
              {username && <p className="text-sm text-muted-foreground">@{username}</p>}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {successMsg && (
              <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="displayName">
                {dict.profile.displayName}
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="username">
                {dict.profile.username}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase())}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                dir="ltr"
                placeholder="your-username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="bio">
                {dict.profile.bio}
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={dict.profile.bioPlaceholder}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {dict.profile.languagePreference}
              </label>
              <div className="flex gap-3">
                {(['fa', 'en'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguagePreference(lang)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      languagePreference === lang
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                  >
                    {lang === 'fa' ? 'فارسی' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Save size={15} />
              {saving ? dict.profile.saving : dict.profile.saveChanges}
            </button>
          </form>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
