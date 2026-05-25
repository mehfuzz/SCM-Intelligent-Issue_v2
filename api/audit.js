// GET  /api/audit?ticket_id=...  → audit log for one ticket (or recent 200)
// POST /api/audit               → write a manual entry

import { query, execute, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id, limit } = req.query;
    const lim = Math.min(Number(limit) || 200, 500);
    try {
      const rows = ticket_id
        ? await query(
            `SELECT * FROM audit_log WHERE ticket_id = :tid ORDER BY at DESC FETCH FIRST :lim ROWS ONLY`,
            { tid: ticket_id, lim }
          )
        : await query(
            `SELECT * FROM audit_log ORDER BY at DESC FETCH FIRST :lim ROWS ONLY`,
            { lim }
          );
      return json(res, 200, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    const actor = requireUser(req);
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    const id = randomUUID();
    try {
      await execute(
        `INSERT INTO audit_log (id, ticket_id, actor_id, actor_name, action, field, before_val, after_val, note)
         VALUES (:id, :ticket_id, :actor_id, :actor_name, :action, :field, :before_val, :after_val, :note)`,
        {
          id,
          ticket_id:  body.ticket_id || null,
          actor_id:   actor.id || null,
          actor_name: actor.name,
          action:     body.action || 'Note',
          field:      body.field || null,
          before_val: body.before == null ? null : String(body.before),
          after_val:  body.after  == null ? null : String(body.after),
          note:       body.note || null,
        }
      );
      const [row] = await query(`SELECT * FROM audit_log WHERE id = :id`, { id });
      return json(res, 201, row);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  json(res, 405, { error: 'Method not allowed' });
}
