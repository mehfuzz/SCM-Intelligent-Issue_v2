// GET /api/health — diagnostic endpoint.
// Returns whether Supabase is configured and reachable end-to-end so the
// frontend can show a clear "live API" vs "demo mode" indicator and the
// operator can debug deploy issues without inspecting logs.

import { handleOptions, json } from './_lib/http.js';
import { isConfigured, supabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const configured = isConfigured();
  const missing = [];
  if (!process.env.SUPABASE_URL)              missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  let dbReachable = false;
  let userCount   = null;
  let dbError     = null;
  if (configured) {
    try {
      const { count, error } = await supabase()
        .from('app_users')
        .select('*', { count: 'exact', head: true });
      if (error) {
        dbError = error.message;
      } else {
        dbReachable = true;
        userCount = count ?? 0;
      }
    } catch (e) {
      dbError = e?.message || String(e);
    }
  }

  json(res, 200, {
    ok: true,
    supabaseConfigured: configured,
    missingEnvVars: missing,
    dbReachable,
    userCount,
    dbError,
    schemaApplied: dbReachable && (userCount ?? 0) > 0,
    time: new Date().toISOString(),
    hint: !configured
      ? 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel project settings, then redeploy.'
      : !dbReachable
        ? 'Supabase env vars are set, but the API could not reach the database. Check the URL / key and that the project is not paused.'
        : (userCount ?? 0) === 0
          ? 'Connected to Supabase but tables are empty. Run supabase/init.sql in the SQL Editor.'
          : 'OK',
  });
}
