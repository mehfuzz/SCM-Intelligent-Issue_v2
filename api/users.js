// GET  /api/users                           → list users
// POST /api/users { action: 'login' }       → authenticate, returns user + mustChangePassword
// POST /api/users { action: 'create_user' } → System Admin creates user with temp password
// POST /api/users { action: 'change_password' } → set new password (first-login or voluntary)
// POST /api/users { action: 'deactivate_user' } → System Admin disables a user
// POST /api/users { action: 'activate_user' }   → System Admin re-enables a user

import bcrypt from 'bcryptjs';
import { query, execute, insertAndFetch, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET')  return listUsers(res);
  if (req.method === 'POST') return postDispatch(req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function listUsers(res) {
  try {
    const rows = await query(
      `SELECT id, name, email, role, department, avatar_initials,
              must_change_password, is_active
       FROM app_users ORDER BY name`,
      {}
    );
    json(res, 200, rows.map(mapUser));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
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

async function loginUser(body, res) {
  const { email, password } = body || {};
  if (!email || !password) return json(res, 400, { error: 'email and password required' });
  try {
    const rows = await query(
      `SELECT * FROM app_users WHERE email = :email`,
      { email: email.toLowerCase().trim() }
    );
    const data = rows[0];
    if (!data) return json(res, 401, { error: 'Invalid email or password' });
    if (!data.is_active) return json(res, 403, { error: 'Account is deactivated. Contact your System Admin.' });
    const match = await bcrypt.compare(password, data.password_hash);
    if (!match) return json(res, 401, { error: 'Invalid email or password' });
    json(res, 200, { user: mapUser(data) });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function createUser(req, body, res) {
  const actor = requireUser(req);
  if (actor.role !== 'System Admin') return json(res, 403, { error: 'Only System Admins can create users' });
  const { name, email, role, department } = body || {};
  if (!name?.trim() || !email?.trim()) return json(res, 400, { error: 'name and email required' });
  const tempPassword   = generateTempPassword();
  const password_hash  = await bcrypt.hash(tempPassword, 10);
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const id = `u${Date.now()}`;
  try {
    const row = await insertAndFetch(
      'app_users',
      { id, name: name.trim(), email: email.toLowerCase().trim(), password_hash,
        must_change_password: true, is_active: true,
        role: role || 'Submitter', department: department?.trim() || null, avatar_initials: initials },
      'SELECT id, name, email, role, department, avatar_initials, must_change_password, is_active FROM app_users WHERE id = :id',
      { id }
    );
    json(res, 201, { user: mapUser(row), tempPassword });
  } catch (e) {
    if (e.message?.includes('ORA-00001')) return json(res, 409, { error: 'A user with that email already exists' });
    json(res, 500, { error: e.message });
  }
}

async function changePassword(req, body, res) {
  const { userId, currentPassword, newPassword } = body || {};
  if (!userId || !newPassword) return json(res, 400, { error: 'userId and newPassword required' });
  if (newPassword.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
  try {
    const rows = await query(
      `SELECT id, password_hash, must_change_password, is_active FROM app_users WHERE id = :id`,
      { id: userId }
    );
    const data = rows[0];
    if (!data) return json(res, 404, { error: 'User not found' });
    if (!data.is_active) return json(res, 403, { error: 'Account is deactivated' });
    if (!data.must_change_password) {
      if (!currentPassword) return json(res, 400, { error: 'currentPassword required' });
      const match = await bcrypt.compare(currentPassword, data.password_hash);
      if (!match) return json(res, 401, { error: 'Current password is incorrect' });
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await execute(
      `UPDATE app_users SET password_hash = :hash, must_change_password = 0 WHERE id = :id`,
      { hash: password_hash, id: userId }
    );
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function setActive(req, body, isActive, res) {
  const actor = requireUser(req);
  if (actor.role !== 'System Admin') return json(res, 403, { error: 'Only System Admins can change user status' });
  const { userId } = body || {};
  if (!userId) return json(res, 400, { error: 'userId required' });
  try {
    await execute(`UPDATE app_users SET is_active = :a WHERE id = :id`, { a: isActive ? 1 : 0, id: userId });
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

function mapUser(u) {
  return {
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    role:               u.role,
    department:         u.department,
    avatarInitials:     u.avatar_initials,
    mustChangePassword: Boolean(u.must_change_password),
    isActive:           u.is_active === undefined ? true : Boolean(u.is_active),
  };
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}
