// GET   /api/notifications?user_id=...
// PATCH /api/notifications        → { id, read: true } to mark read

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') {
    const { user_id } = req.query;
    let q = supabase().from('notifications').select('*').order('at', { ascending: false });
    if (user_id) q = q.eq('user_id', user_id);
    const { data, error } = await q;
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, data || []);
  }

  if (req.method === 'PATCH') {
    let body;
    try { body = await readBody(req); }
    catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!body.id) return json(res, 400, { error: 'id required' });
    const { error } = await supabase().from('notifications')
      .update({ read: !!body.read }).eq('id', body.id);
    if (error) return json(res, 500, { error: error.message });
    return json(res, 204, {});
  }

  json(res, 405, { error: 'Method not allowed' });
}
