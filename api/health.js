// GET /api/health — diagnostic endpoint.
// Returns whether Supabase is configured and reachable end-to-end so the
// frontend can show a clear "live API" vs "demo mode" indicator and the
// operator can debug deploy issues without inspecting logs.

import { handleOptions, json } from './_lib/http.js';
import { isConfigured, supabase } from './_lib/supabase.js';

// Decode the role claim from a Supabase JWT (base64url-decode the middle
// segment). We do not verify the signature — this is a debugging aid only,
// to catch the very common "pasted the anon key by mistake" mistake.
function jwtRole(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return decoded?.role || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const configured = isConfigured();
  const missing = [];
  if (!process.env.SUPABASE_URL)              missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const detectedRole = jwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const wrongKey = configured && detectedRole && detectedRole !== 'service_role';

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

  let hint;
  if (!configured) {
    hint = 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel project settings, then redeploy.';
  } else if (!dbReachable) {
    hint = 'Supabase env vars are set, but the API could not reach the database. Check the URL / key and that the project is not paused.';
  } else if (wrongKey) {
    hint = `SUPABASE_SERVICE_ROLE_KEY appears to be the "${detectedRole}" key, not the service_role key. Anon keys are blocked by RLS and silently return 0 rows. Replace the env var with the service_role key from Supabase → Project Settings → API, then redeploy.`;
  } else if ((userCount ?? 0) === 0) {
    hint = 'Connected to Supabase but tables are empty. Either run the seed against this project, or update SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in Vercel to point at the project where you already loaded the data.';
  } else {
    hint = 'OK';
  }

  json(res, 200, {
    ok: true,
    supabaseConfigured: configured,
    supabaseUrl: process.env.SUPABASE_URL || null,
    serviceRoleKeyDetectedAs: detectedRole,
    wrongKey,
    missingEnvVars: missing,
    dbReachable,
    userCount,
    dbError,
    schemaApplied: dbReachable && (userCount ?? 0) > 0,
    time: new Date().toISOString(),
    hint,
  });
}
