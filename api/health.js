// GET /api/health — diagnostic endpoint.
// Returns whether Supabase is configured and reachable end-to-end so the
// frontend can show a clear "live API" vs "demo mode" indicator and the
// operator can debug deploy issues without inspecting logs.

import { handleOptions, json } from './_lib/http.js';
import { isConfigured, supabase } from './_lib/supabase.js';

// Identify the kind of Supabase key in SUPABASE_SERVICE_ROLE_KEY. We support
// both formats:
//   * Legacy JWT keys — middle segment base64-decodes to a JSON payload with a
//     `role` claim. We look at that.
//   * New "publishable / secret" keys — they aren't JWTs, but start with a
//     `sb_publishable_` or `sb_secret_` prefix.
// This is a debugging aid only; no signatures are verified.
function classifyKey(token) {
  if (!token || typeof token !== 'string') return { kind: null, role: null };
  if (token.startsWith('sb_secret_'))      return { kind: 'new', role: 'secret'      };
  if (token.startsWith('sb_publishable_')) return { kind: 'new', role: 'publishable' };
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      return { kind: 'jwt', role: decoded?.role || null };
    } catch { /* fall through */ }
  }
  return { kind: 'unknown', role: null };
}

// Detect the very common "I copied the URL with /rest/v1/ on the end" mistake.
function checkUrl(raw) {
  if (!raw) return { url: null, warning: null };
  const stripped = String(raw).replace(/\/+$/, '');
  if (/\/rest\/v1(\/|$)/i.test(stripped) ||
      /\/auth\/v1(\/|$)/i.test(stripped) ||
      /\/storage\/v1(\/|$)/i.test(stripped)) {
    return {
      url: raw,
      warning: `SUPABASE_URL must be the project root (e.g. https://<ref>.supabase.co), not an API sub-path. Yours currently has a service path appended.`,
    };
  }
  return { url: raw, warning: null };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const configured = isConfigured();
  const missing = [];
  if (!process.env.SUPABASE_URL)              missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const { kind: keyKind, role: keyRole } = classifyKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const wrongKey =
    configured && (
      (keyKind === 'jwt' && keyRole && keyRole !== 'service_role') ||
      (keyKind === 'new' && keyRole !== 'secret')
    );

  const urlInfo = checkUrl(process.env.SUPABASE_URL);

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
  } else if (urlInfo.warning) {
    hint = `${urlInfo.warning} Fix the env var in Vercel and redeploy.`;
  } else if (wrongKey) {
    hint = `SUPABASE_SERVICE_ROLE_KEY appears to be a "${keyRole}" key, not a service-role / secret key. Anon / publishable keys are blocked by RLS and silently return 0 rows. Replace the env var with the service_role secret from Supabase → Project Settings → API, then redeploy.`;
  } else if (!dbReachable) {
    hint = 'Supabase env vars are set, but the API could not reach the database. Check the URL / key and that the project is not paused.';
  } else if ((userCount ?? 0) === 0) {
    hint = 'Connected to Supabase but the app_users table is empty in the project the API points at. Either run the seed against this project, or update SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to the project where you loaded the data.';
  } else {
    hint = 'OK';
  }

  json(res, 200, {
    ok: true,
    supabaseConfigured: configured,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseUrlWarning: urlInfo.warning,
    serviceRoleKeyKind: keyKind,         // 'jwt' | 'new' | 'unknown' | null
    serviceRoleKeyDetectedAs: keyRole,   // 'service_role' | 'anon' | 'secret' | 'publishable' | null
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
