// GET /api/audit?ticket_id=...   → audit log for one ticket
// GET /api/audit                 → recent audit log (default 200 rows)
// POST /api/audit                → write an entry (used for client-side notes
//                                  that don't map to a single PATCH).

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id, limit } = req.query;
    let q = supabase().from('audit_log').select('*').order('at', { ascending: false });
    if (ticket_id) q = q.eq('ticket_id', ticket_id);
    q = q.limit(Number(limit) || 200);
    const { data, error } = await q;
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, data || []);
  }

  if (req.method === 'POST') {
    const actor = requireUser(req);
    let body;
    try { body = await readBody(req); }
    catch { return json(res, 400, { error: 'Invalid JSON body' }); }

    const entry = {
      ticket_id: body.ticket_id,
      actor_id: actor.id,
      actor_name: actor.name,
      action: body.action || 'Note',
      field: body.field || null,
      before_val: body.before == null ? null : String(body.before),
      after_val:  body.after  == null ? null : String(body.after),
      note: body.note || null,
    };
    const { data, error } = await supabase().from('audit_log').insert(entry).select().single();
    if (error) return json(res, 500, { error: error.message });
    return json(res, 201, data);
  }

  json(res, 405, { error: 'Method not allowed' });
}
