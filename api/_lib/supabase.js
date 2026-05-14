import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Keep this loud so misconfigured deploys fail fast at request time.
  console.warn('[api] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
}

// supabase-js v2 instantiates a RealtimeClient eagerly inside createClient(),
// which on Node < 22 throws because there is no native WebSocket constructor.
// We never use realtime (only PostgREST queries), but the construction error
// kills the entire client. Provide the `ws` polyfill as a transport so the
// realtime client can be constructed harmlessly on any Node version.
let client;
export const supabase = () => {
  if (!client) {
    client = createClient(url ?? '', key ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket },
    });
  }
  return client;
};

export const isConfigured = () => Boolean(url && key);
