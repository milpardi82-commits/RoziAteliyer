/**
 * Auth and identity types for Phase 2.
 */

export type UserProfile = {
  id: string;          // = auth.users.id
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  language_preference: 'fa' | 'en' | null;
  created_at: string;
  updated_at: string;
};

export type AuthUser = {
  id: string;
  email: string | null;
  profile: UserProfile | null;
};
