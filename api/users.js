// GET  /api/users           → list users (assignment dropdowns, role pickers, etc.)
// POST /api/users           → mock login when body has { email, password }
//
// Merged from the previous api/auth/login.js to stay under Vercel Hobby's
// 12-function limit.

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') return listUsers(res);
  if (req.method === 'POST') return loginUser(req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function listUsers(res) {
  const { data, error } = await supabase().from('app_users').select('*').order('name');
  if (error) return json(res, 500, { error: error.message });
  json(res, 200, (data || []).map(({ password, ...rest }) => ({
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    department: rest.department,
    avatarInitials: rest.avatar_initials,
  })));
}

async function loginUser(req, res) {
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
