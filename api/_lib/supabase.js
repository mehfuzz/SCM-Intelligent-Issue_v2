import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Keep this loud so misconfigured deploys fail fast at request time.
  console.warn('[api] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
}

// Singleton across warm invocations.
let client;
export const supabase = () => {
  if (!client) {
    client = createClient(url ?? '', key ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

export const isConfigured = () => Boolean(url && key);
