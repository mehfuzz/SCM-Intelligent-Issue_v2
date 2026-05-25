// GET   /api/tickets/[id]
// PATCH /api/tickets/[id]   → field updates with audit logging
// DELETE/api/tickets/[id]   → admin-only

import { query, execute, isConfigured, randomUUID } from '../_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { rowToTicket, patchToRow } from '../_lib/mappers.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  const { id } = req.query;
  if (!id) return json(res, 400, { error: 'Missing ticket id' });

  if (req.method === 'GET')    return getTicket(id, res);
  if (req.method === 'PATCH')  return patchTicket(id, req, res);
  if (req.method === 'DELETE') return deleteTicket(id, req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function getTicket(id, res) {
  try {
    const rows = await query(`SELECT * FROM tickets WHERE id = :id`, { id });
    if (!rows.length) return json(res, 404, { error: 'Ticket not found' });
    json(res, 200, rowToTicket(rows[0]));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function patchTicket(id, req, res) {
  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  try {
    const current = (await query(`SELECT * FROM tickets WHERE id = :id`, { id }))[0];
    if (!current) return json(res, 404, { error: 'Ticket not found' });

    const row = patchToRow(body);
    if (Object.keys(row).length === 0) return json(res, 400, { error: 'No updatable fields supplied' });

    const setClauses = Object.keys(row).map((k) => `${k} = :${k}`).join(', ');
    await execute(`UPDATE tickets SET ${setClauses} WHERE id = :_id`, { ...row, _id: id });

    const note = typeof body.note === 'string' ? body.note : null;
    for (const [k, v] of Object.entries(row)) {
      if (current[k] === v) continue;
      await execute(
        `INSERT INTO audit_log (id, ticket_id, actor_id, actor_name, action, field, before_val, after_val, note)
         VALUES (:id, :ticket_id, :actor_id, :actor_name, :action, :field, :before_val, :after_val, :note)`,
        {
          id:         randomUUID(),
          ticket_id:  id,
          actor_id:   actor.id || null,
          actor_name: actor.name,
          action:     `${k} changed`,
          field:      k,
          before_val: current[k] == null ? null : String(current[k]),
          after_val:  v == null ? null : String(v),
          note,
        }
      );
    }

    const [data] = await query(`SELECT * FROM tickets WHERE id = :id`, { id });
    json(res, 200, rowToTicket(data));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function deleteTicket(id, req, res) {
  const actor = requireUser(req);
  if (actor.role !== 'COE Admin' && actor.role !== 'System Admin') {
    return json(res, 403, { error: 'Forbidden' });
  }
  try {
    await execute(`DELETE FROM tickets WHERE id = :id`, { id });
    json(res, 204, null);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}
