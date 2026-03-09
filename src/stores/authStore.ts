import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

interface AuthStore {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  needsUsername: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setUsername: (username: string) => Promise<{ error: string | null }>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', userId)
    .single();
  return data;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  needsUsername: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      set({
        user: session.user,
        session,
        profile,
        needsUsername: !profile,
        loading: false,
      });
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        set({
          user: session.user,
          session,
          profile,
          needsUsername: !profile,
        });
      } else {
        set({
          user: null,
          session: null,
          profile: null,
          needsUsername: false,
        });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      needsUsername: false,
    });
  },

  setUsername: async (username) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, username })
      .select('id, username, display_name')
      .single();

    if (error) {
      // Postgres unique violation
      if (error.code === '23505') {
        return { error: 'Username already taken' };
      }
      return { error: error.message };
    }

    set({ profile: data, needsUsername: false });
    return { error: null };
  },
}));
