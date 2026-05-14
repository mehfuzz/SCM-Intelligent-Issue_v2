// GET  /api/comments?ticket_id=...
// POST /api/comments

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;
    let q = supabase().from('comments').select('*').order('at', { ascending: false });
    if (ticket_id) q = q.eq('ticket_id', ticket_id);
    const { data, error } = await q;
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, data || []);
  }

  if (req.method === 'POST') {
    const actor = requireUser(req);
    let body;
    try { body = await readBody(req); }
    catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!body.ticket_id || !body.body) {
      return json(res, 400, { error: 'ticket_id and body are required' });
    }
    const { data, error } = await supabase().from('comments').insert({
      ticket_id: body.ticket_id,
      author_id: actor.id,
      author: actor.name,
      author_role: actor.role,
      body: body.body,
    }).select().single();
    if (error) return json(res, 500, { error: error.message });
    return json(res, 201, data);
  }

  json(res, 405, { error: 'Method not allowed' });
}
