// GET  /api/tickets   → list (optionally scoped by ?role/?user_id)
// POST /api/tickets   → create a new ticket

import { query, execute, isConfigured, randomUUID } from '../_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { rowToTicket, ticketToRow } from '../_lib/mappers.js';
import { computeScoresAndTier } from '../_lib/priority.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') return listTickets(req, res);
  if (req.method === 'POST') return createTicket(req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function listTickets(req, res) {
  const { role, user_id } = req.query;
  try {
    let rows;
    if (role === 'Submitter' && user_id) {
      rows = await query(
        `SELECT * FROM tickets WHERE submitted_by_id = :uid ORDER BY submitted_at DESC`,
        { uid: user_id }
      );
    } else if (role === 'POC Owner' && user_id) {
      rows = await query(
        `SELECT * FROM tickets WHERE assigned_to_id = :uid ORDER BY submitted_at DESC`,
        { uid: user_id }
      );
    } else {
      rows = await query(`SELECT * FROM tickets ORDER BY submitted_at DESC`, {});
    }
    json(res, 200, rows.map(rowToTicket));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function createTicket(req, res) {
  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  const modCode = (body.module || 'XXX').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  try {
    const existing = await query(
      `SELECT id FROM tickets WHERE id LIKE :pat`,
      { pat: `SCM-${modCode}-%` }
    );
    const nextNum = String((existing?.length || 0) + 1).padStart(3, '0');
    const id = `SCM-${modCode}-${nextNum}`;

    const all = await query(`SELECT * FROM tickets`, {});
    const candidateRow = ticketToRow({
      ...body, id,
      submittedBy:   actor.name,
      submittedById: actor.id,
      submittedAt:   new Date(),
      status: 'Submitted',
      assignedTo: null, assignedToId: null,
    });
    const scores = computeScoresAndTier(candidateRow, [...all, candidateRow]);
    candidateRow.priority = scores.tier;

    const cols = Object.keys(candidateRow).filter((k) => candidateRow[k] !== undefined);
    const placeholders = cols.map((c) => `:${c}`).join(', ');
    await execute(
      `INSERT INTO tickets (${cols.join(', ')}) VALUES (${placeholders})`,
      candidateRow
    );

    // Audit entries
    const auditBase = { ticket_id: id, actor_name: actor.name };
    await execute(
      `INSERT INTO audit_log (id, ticket_id, actor_id, actor_name, action) VALUES (:id, :ticket_id, :actor_id, :actor_name, :action)`,
      { id: randomUUID(), ...auditBase, actor_id: actor.id || null, action: 'Issue submitted' }
    );
    await execute(
      `INSERT INTO audit_log (id, ticket_id, actor_id, actor_name, action, field, after_val) VALUES (:id, :ticket_id, :actor_id, :actor_name, :action, :field, :after_val)`,
      {
        id: randomUUID(), ticket_id: id, actor_id: null, actor_name: 'System',
        action: scores.tier === 'P0' ? 'Priority Zero Override' : 'Auto-prioritisation',
        field: 'Priority', after_val: scores.tier,
      }
    );

    const [data] = await query(`SELECT * FROM tickets WHERE id = :id`, { id });
    json(res, 201, rowToTicket(data));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}
