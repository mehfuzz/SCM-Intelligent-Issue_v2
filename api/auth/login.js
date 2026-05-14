// POST /api/auth/login — mock login against the app_users table.
// This is intentionally simple: the demo system uses cleartext passwords
// from the seed. Swap for Supabase Auth + JWT before production.

import { supabase, isConfigured } from '../_lib/supabase.js';
import { handleOptions, json, readBody } from '../_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  const { email, password } = body || {};
  if (!email || !password) return json(res, 400, { error: 'email and password required' });

  const { data, error } = await supabase()
    .from('app_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) return json(res, 500, { error: error.message });
  if (!data || data.password !== password) return json(res, 401, { error: 'Invalid email or password' });

  const { password: _pw, avatar_initials, ...rest } = data;
  json(res, 200, { user: { ...rest, avatarInitials: avatar_initials } });
}
