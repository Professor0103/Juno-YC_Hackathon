import { createClient } from '@supabase/supabase-js';

/**
 * Two values, and only two. Vite inlines every VITE_* variable into the shipped
 * bundle, so .env.local is a public file by construction and anything else put in
 * it is published. The anon key is designed for that; nothing else is.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

let bootstrapping = null;

/**
 * Anonymous auth, once per load. No sign-up, no email, no password, no profile —
 * the session in localStorage is the whole of the user's identity, and RLS keys
 * every entry to the uid inside it, so two devices are two strangers.
 *
 * The promise is memoised because the arc calls this from several places at once
 * on first load, and two concurrent signInAnonymously() calls would create two
 * users and leave the first one's rows unreachable.
 */
export function ensureSession() {
  bootstrapping ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return created.session;
  })();

  return bootstrapping;
}
