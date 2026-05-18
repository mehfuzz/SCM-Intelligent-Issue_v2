// GET  /api/users                           → list users
// POST /api/users { action: 'login' }       → authenticate, returns user + must_change_password
// POST /api/users { action: 'create_user' } → System Admin creates user with temp password
// POST /api/users { action: 'change_password' } → set new password (first-login or voluntary)
// POST /api/users { action: 'deactivate_user' } → System Admin disables a user
// POST /api/users { action: 'activate_user' }   → System Admin re-enables a user

import bcrypt from 'bcryptjs';
import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET')  return listUsers(res);
  if (req.method === 'POST') return postDispatch(req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function listUsers(res) {
  const { data, error } = await supabase()
    .from('app_users')
    .select('id, name, email, role, department, avatar_initials, must_change_password, is_active')
    .order('name');
  if (error) return json(res, 500, { error: error.message });
  json(res, 200, (data || []).map(mapUser));
}

async function postDispatch(req, res) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const action = body?.action || 'login';
  if (action === 'login')           return loginUser(body, res);
  if (action === 'create_user')     return createUser(req, body, res);
  if (action === 'change_password') return changePassword(req, body, res);
  if (action === 'deactivate_user') return setActive(req, body, false, res);
  if (action === 'activate_user')   return setActive(req, body, true, res);
  return json(res, 400, { error: `Unknown action: ${action}` });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
async function loginUser(body, res) {
  const { email, password } = body || {};
  if (!email || !password) return json(res, 400, { error: 'email and password required' });

  const { data, error } = await supabase()
    .from('app_users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) return json(res, 500, { error: error.message });
  if (!data) return json(res, 401, { error: 'Invalid email or password' });
  if (!data.is_active) return json(res, 403, { error: 'Account is deactivated. Contact your System Admin.' });

  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) return json(res, 401, { error: 'Invalid email or password' });

  json(res, 200, { user: mapUser(data) });
}

// ---------------------------------------------------------------------------
// Create user (System Admin only)
// ---------------------------------------------------------------------------
async function createUser(req, body, res) {
  const actor = requireUser(req);
  if (actor.role !== 'System Admin') return json(res, 403, { error: 'Only System Admins can create users' });

  const { name, email, role, department } = body || {};
  if (!name?.trim() || !email?.trim()) return json(res, 400, { error: 'name and email required' });

  const tempPassword = generateTempPassword();
  const password_hash = await bcrypt.hash(tempPassword, 10);
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const id = `u${Date.now()}`;

  const { data, error } = await supabase()
    .from('app_users')
    .insert({
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      must_change_password: true,
      is_active: true,
      role: role || 'Submitter',
      department: department?.trim() || null,
      avatar_initials: initials,
    })
    .select('id, name, email, role, department, avatar_initials, must_change_password, is_active')
    .single();

  if (error) {
    if (error.code === '23505') return json(res, 409, { error: 'A user with that email already exists' });
    return json(res, 500, { error: error.message });
  }

  json(res, 201, { user: mapUser(data), tempPassword });
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------
async function changePassword(req, body, res) {
  const { userId, currentPassword, newPassword } = body || {};
  if (!userId || !newPassword) return json(res, 400, { error: 'userId and newPassword required' });
  if (newPassword.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });

  const { data, error } = await supabase()
    .from('app_users')
    .select('id, password_hash, must_change_password, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) return json(res, 500, { error: error.message });
  if (!data) return json(res, 404, { error: 'User not found' });
  if (!data.is_active) return json(res, 403, { error: 'Account is deactivated' });

  // If must_change_password, skip old-password check (it's a temp password set by admin).
  // Otherwise, verify the current password first.
  if (!data.must_change_password) {
    if (!currentPassword) return json(res, 400, { error: 'currentPassword required' });
    const match = await bcrypt.compare(currentPassword, data.password_hash);
    if (!match) return json(res, 401, { error: 'Current password is incorrect' });
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error: upErr } = await supabase()
    .from('app_users')
    .update({ password_hash, must_change_password: false })
    .eq('id', userId);

  if (upErr) return json(res, 500, { error: upErr.message });
  json(res, 200, { ok: true });
}

// ---------------------------------------------------------------------------
// Deactivate / activate (System Admin only)
// ---------------------------------------------------------------------------
async function setActive(req, body, isActive, res) {
  const actor = requireUser(req);
  if (actor.role !== 'System Admin') return json(res, 403, { error: 'Only System Admins can change user status' });

  const { userId } = body || {};
  if (!userId) return json(res, 400, { error: 'userId required' });

  const { error } = await supabase()
    .from('app_users')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) return json(res, 500, { error: error.message });
  json(res, 200, { ok: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapUser(u) {
  return {
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    role:               u.role,
    department:         u.department,
    avatarInitials:     u.avatar_initials,
    mustChangePassword: u.must_change_password ?? false,
    isActive:           u.is_active ?? true,
  };
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}
