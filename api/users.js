// GET /api/users — list all users (mock auth, used for assignment dropdowns).

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { data, error } = await supabase().from('app_users').select('*').order('name');
  if (error) return json(res, 500, { error: error.message });

  // Strip password before sending to the client.
  json(res, 200, (data || []).map(({ password, ...rest }) => ({
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    department: rest.department,
    avatarInitials: rest.avatar_initials,
  })));
}
