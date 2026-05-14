// GET   /api/tickets/[id]
// PATCH /api/tickets/[id]   → field updates with audit logging
// DELETE/api/tickets/[id]   → admin-only (not exposed in UI yet)

import { supabase, isConfigured } from '../_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { rowToTicket, patchToRow } from '../_lib/mappers.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  const { id } = req.query;
  if (!id) return json(res, 400, { error: 'Missing ticket id' });

  if (req.method === 'GET') return getTicket(id, res);
  if (req.method === 'PATCH') return patchTicket(id, req, res);
  if (req.method === 'DELETE') return deleteTicket(id, req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function getTicket(id, res) {
  const { data, error } = await supabase().from('tickets').select('*').eq('id', id).single();
  if (error) return json(res, 404, { error: error.message });
  json(res, 200, rowToTicket(data));
}

async function patchTicket(id, req, res) {
  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  // Fetch current row so we can write before/after values to the audit log.
  const { data: current, error: fetchErr } = await supabase()
    .from('tickets').select('*').eq('id', id).single();
  if (fetchErr) return json(res, 404, { error: fetchErr.message });

  const row = patchToRow(body);
  if (Object.keys(row).length === 0) return json(res, 400, { error: 'No updatable fields supplied' });

  const { data, error } = await supabase()
    .from('tickets').update(row).eq('id', id).select().single();
  if (error) return json(res, 500, { error: error.message });

  // Diff and log each changed field. `note` is optional and useful for SLA changes.
  const note = typeof body.note === 'string' ? body.note : null;
  const entries = [];
  for (const [k, v] of Object.entries(row)) {
    if (current[k] === v) continue;
    entries.push({
      ticket_id: id,
      actor_id: actor.id,
      actor_name: actor.name,
      action: `${k} changed`,
      field: k,
      before_val: current[k] == null ? null : String(current[k]),
      after_val:  v == null ? null : String(v),
      note,
    });
  }
  if (entries.length) await supabase().from('audit_log').insert(entries);

  json(res, 200, rowToTicket(data));
}

async function deleteTicket(id, req, res) {
  const actor = requireUser(req);
  if (actor.role !== 'COE Admin' && actor.role !== 'System Admin') {
    return json(res, 403, { error: 'Forbidden' });
  }
  const { error } = await supabase().from('tickets').delete().eq('id', id);
  if (error) return json(res, 500, { error: error.message });
  json(res, 204, {});
}
