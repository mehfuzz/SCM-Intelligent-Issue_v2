// GET  /api/test-evidence?ticket_id=...
// POST /api/test-evidence   → { ticket_id, label, url } (POC owners attach
//                              screenshots/links the submitter validates against)

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;
    let q = supabase().from('test_evidence').select('*').order('at', { ascending: false });
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
    if (!body.ticket_id || !body.label || !body.url) {
      return json(res, 400, { error: 'ticket_id, label, url required' });
    }
    const { data, error } = await supabase().from('test_evidence').insert({
      ticket_id: body.ticket_id,
      label: body.label,
      url: body.url,
      uploaded_by: actor.name,
    }).select().single();
    if (error) return json(res, 500, { error: error.message });
    return json(res, 201, data);
  }

  json(res, 405, { error: 'Method not allowed' });
}
