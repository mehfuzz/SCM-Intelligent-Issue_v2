// GET  /api/comments?ticket_id=...
// POST /api/comments

import { query, execute, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;
    try {
      const rows = ticket_id
        ? await query(`SELECT * FROM comments WHERE ticket_id = :tid ORDER BY at DESC`, { tid: ticket_id })
        : await query(`SELECT * FROM comments ORDER BY at DESC FETCH FIRST 200 ROWS ONLY`, {});
      return json(res, 200, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    const actor = requireUser(req);
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!body.ticket_id || !body.body) return json(res, 400, { error: 'ticket_id and body are required' });
    const id = randomUUID();
    try {
      await execute(
        `INSERT INTO comments (id, ticket_id, author_id, author, author_role, body)
         VALUES (:id, :ticket_id, :author_id, :author, :author_role, :body)`,
        { id, ticket_id: body.ticket_id, author_id: actor.id || null,
          author: actor.name, author_role: actor.role || null, body: body.body }
      );
      const [row] = await query(`SELECT * FROM comments WHERE id = :id`, { id });
      return json(res, 201, row);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  json(res, 405, { error: 'Method not allowed' });
}
