// GET  /api/test-evidence?ticket_id=...
// POST /api/test-evidence   → { ticket_id, label, url }

import { query, execute, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;
    try {
      const rows = ticket_id
        ? await query(`SELECT * FROM test_evidence WHERE ticket_id = :tid ORDER BY at DESC`, { tid: ticket_id })
        : await query(`SELECT * FROM test_evidence ORDER BY at DESC FETCH FIRST 200 ROWS ONLY`, {});
      return json(res, 200, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    const actor = requireUser(req);
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!body.ticket_id || !body.label || !body.url) {
      return json(res, 400, { error: 'ticket_id, label, url required' });
    }
    const id = randomUUID();
    try {
      await execute(
        `INSERT INTO test_evidence (id, ticket_id, label, url, uploaded_by)
         VALUES (:id, :ticket_id, :label, :url, :uploaded_by)`,
        { id, ticket_id: body.ticket_id, label: body.label, url: body.url, uploaded_by: actor.name }
      );
      const [row] = await query(`SELECT * FROM test_evidence WHERE id = :id`, { id });
      return json(res, 201, row);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  json(res, 405, { error: 'Method not allowed' });
}
