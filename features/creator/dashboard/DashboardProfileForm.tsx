/**
 * Dashboard Creator Profile — profile editing form for the creator dashboard.
 *
 * Client Component: handles form state and submission via the browser
 * Supabase client. RLS `update_own_creator_v3` ensures only the owner
 * can update their own row.
 *
 * Only exposes safe, mutable fields defined in CreatorProfileUpdate.
 * Status, id, user_id, handle are not editable here.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/components/locale-provider';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';
import type { Creator } from '@/types/marketplace';

interface Props {
  creator: Creator;
  locale: string;
}

export function DashboardProfileForm({ creator, locale }: Props) {
  const { dict } = useLocale();
  const d = dict.dashboard;
  const router = useRouter();

  const [displayName, setDisplayName] = useState(creator.display_name ?? '');
  const [bio,         setBio]         = useState(creator.bio         ?? '');
  const [website,     setWebsite]     = useState(creator.website_url ?? '');
  const [location,    setLocation]    = useState(creator.location    ?? '');

  const [saving,     setSaving]     = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const supabase = supabaseAuthClient();
    const { error } = await supabase
      .from('creators')
      .update({
        display_name: displayName.trim() || null,
        bio:          bio.trim()         || null,
        website_url:  website.trim()     || null,
        location:     location.trim()    || null,
      })
      .eq('id', creator.id);

    setSaving(false);

    if (error) {
      setErrorMsg(d.profileError);
    } else {
      setSuccessMsg(d.profileSaved);
      router.refresh();
    }
  }

  const base = `/${locale}`;

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold">{d.profileTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">@{creator.handle}</p>
        </div>
        <Link
          href={`${base}/artists/${creator.handle}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={14} />
          {d.profileViewPublic}
        </Link>
      </div>

      {/* Creator avatar display (no upload in Phase 6) */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
          {creator.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.display_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full grid place-items-center bg-primary/10 text-primary font-bold text-xl">
              {creator.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold">{creator.display_name}</p>
          <p className="text-xs text-muted-foreground">@{creator.handle}</p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="space-y-5">
        {successMsg && (
          <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Handle (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            {d.profileHandle}
          </label>
          <input
            type="text"
            value={`@${creator.handle}`}
            readOnly
            disabled
            dir="ltr"
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Display name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="displayName">
            {d.profileDisplayName}
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="bio">
            {d.profileBio}
          </label>
          <textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={d.profileBioPlaceholder}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Website */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="website">
            {d.profileWebsite}
          </label>
          <input
            id="website"
            type="url"
            dir="ltr"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={d.profileWebsitePlaceholder}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Location */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="location">
            {d.profileLocation}
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={d.profileLocationPlaceholder}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? d.profileSaving : d.profileSaveChanges}
        </button>
      </form>
    </div>
  );
}
