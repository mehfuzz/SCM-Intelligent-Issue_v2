// GET   /api/notifications?user_id=...  → list for a user
// POST  /api/notifications              → fan-out: { recipients:[userId,...], type, title, message, ticketId? }
// PATCH /api/notifications              → { id, read: true } mark read

import { query, execute, insertMany, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') {
    const { user_id } = req.query;
    try {
      const rows = user_id
        ? await query(`SELECT * FROM notifications WHERE user_id = :uid ORDER BY at DESC`, { uid: user_id })
        : await query(`SELECT * FROM notifications ORDER BY at DESC FETCH FIRST 200 ROWS ONLY`, {});
      return json(res, 200, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    const recipients = Array.isArray(body.recipients)
      ? body.recipients
      : (body.user_id ? [body.user_id] : []);
    const uniq = Array.from(new Set(recipients.filter(Boolean)));
    if (!uniq.length)  return json(res, 400, { error: 'No recipients' });
    if (!body.type)    return json(res, 400, { error: 'type required' });
    if (!body.title)   return json(res, 400, { error: 'title required' });
    const rows = uniq.map((uid) => ({
      id:        randomUUID(),
      user_id:   uid,
      type:      body.type,
      title:     body.title,
      message:   body.message || '',
      ticket_id: body.ticket_id || body.ticketId || null,
    }));
    try {
      await insertMany('notifications', rows);
      return json(res, 201, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!body.id) return json(res, 400, { error: 'id required' });
    try {
      await execute(`UPDATE notifications SET read = :r WHERE id = :id`, { r: body.read ? 1 : 0, id: body.id });
      return json(res, 204, null);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  json(res, 405, { error: 'Method not allowed' });
}
