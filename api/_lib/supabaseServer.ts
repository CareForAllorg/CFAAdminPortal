import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.generated.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;

// One client per request, built with the anon key and the caller's own
// JWT forwarded as the Authorization header -- not a shared service-role
// client. That keeps every API request subject to the exact same RLS
// policies (and the auth.uid()-based review-audit trigger) as when the
// frontend called Supabase directly. This layer adds a CRUD/API boundary
// without silently widening what a request is allowed to touch.
export function supabaseForToken(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The only service-role client in this codebase -- every other endpoint
// deliberately uses supabaseForToken so RLS applies. This exists solely
// for the mentor-application webhook (api/_handlers/mentorApplications.ts),
// which is called by a Google Apps Script trigger with no Supabase user
// session to forward, so there's no JWT to scope a normal client to.
// Gated by its own shared-secret check in the handler, not by RLS.
export function supabaseServiceRole(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
