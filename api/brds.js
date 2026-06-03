// BRD persistence — the brds table existed but nothing wrote to it.
//
//   GET  /api/brds                       → list (role-scoped via X-User-* headers)
//   GET  /api/brds?id=BRD-XYZ            → single BRD by id
//   GET  /api/brds?ticket_id=SCM-XYZ-001 → BRD attached to a ticket (or null)
//   POST /api/brds                       → upsert (idempotent on ticket_id)
//                                          Also updates tickets.brd_id + brd_status
//                                          so role-scoped views see the link.
//
// We deliberately reuse the same `brds` table the schema already has —
// no new migration needed.

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

const ROLES_SEE_ALL = new Set(['COE Admin', 'Leadership', 'System Admin']);

const rowToBrd = (r) => ({
  id:         r.id,
  ticketId:   r.ticket_id,
  title:      r.title,
  status:     r.status,
  version:    r.version,
  sections:   r.sections || {},
  versions:   r.versions || [],
  createdAt:  r.created_at,
  updatedAt:  r.updated_at,
});

// Generate a stable BRD id from a ticket id: SCM-PO-004 → BRD-PO-004.
const brdIdFromTicket = (ticketId) => {
  if (!ticketId) return null;
  return `BRD-${String(ticketId).replace(/^SCM-/, '')}`;
};

// Filter a BRD row list by the calling user's role.
const filterByRole = async (rows, actor) => {
  if (ROLES_SEE_ALL.has(actor.role) || !actor.id) return rows;
  if (!rows.length) return rows;
  const ticketIds = rows.map((r) => r.ticket_id).filter(Boolean);
  if (!ticketIds.length) return [];
  const { data: tickets, error } = await supabase()
    .from('tickets').select('id, submitted_by_id, assigned_to_id')
    .in('id', ticketIds);
  if (error) throw new Error(`tickets fetch: ${error.message}`);
  const allowed = new Set(
    (tickets || [])
      .filter((t) =>
        (actor.role === 'Submitter' && t.submitted_by_id === actor.id) ||
        (actor.role === 'POC Owner' && t.assigned_to_id  === actor.id)
      )
      .map((t) => t.id),
  );
  return rows.filter((r) => allowed.has(r.ticket_id));
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  const actor = requireUser(req);

  if (req.method === 'GET') {
    const { id, ticket_id } = req.query;

    if (id) {
      const { data, error } = await supabase().from('brds').select('*').eq('id', id).maybeSingle();
      if (error) return json(res, 500, { error: error.message });
      if (!data) return json(res, 404, { error: 'BRD not found' });
      const allowed = await filterByRole([data], actor);
      if (!allowed.length) return json(res, 403, { error: 'forbidden' });
      return json(res, 200, rowToBrd(data));
    }

    if (ticket_id) {
      const { data, error } = await supabase()
        .from('brds').select('*').eq('ticket_id', ticket_id).maybeSingle();
      if (error) return json(res, 500, { error: error.message });
      if (!data) return json(res, 200, null);  // not 404 — "no BRD yet" is a legitimate state
      const allowed = await filterByRole([data], actor);
      if (!allowed.length) return json(res, 403, { error: 'forbidden' });
      return json(res, 200, rowToBrd(data));
    }

    const { data, error } = await supabase()
      .from('brds').select('*').order('updated_at', { ascending: false }).limit(200);
    if (error) return json(res, 500, { error: error.message });
    const scoped = await filterByRole(data || [], actor);
    return json(res, 200, scoped.map(rowToBrd));
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch { return json(res, 400, { error: 'Invalid JSON body' }); }

    const ticketId = body.ticketId || body.ticket_id;
    if (!ticketId) return json(res, 400, { error: 'ticketId required' });

    // Verify the user is actually allowed to write to this BRD.
    const { data: ticket, error: tErr } = await supabase()
      .from('tickets').select('id, submitted_by_id, assigned_to_id, title')
      .eq('id', ticketId).maybeSingle();
    if (tErr)   return json(res, 500, { error: `ticket lookup: ${tErr.message}` });
    if (!ticket) return json(res, 404, { error: 'ticket not found' });

    const canWrite =
      ROLES_SEE_ALL.has(actor.role) ||
      (actor.role === 'Submitter' && ticket.submitted_by_id === actor.id) ||
      (actor.role === 'POC Owner' && ticket.assigned_to_id  === actor.id);
    if (!canWrite) return json(res, 403, { error: 'forbidden' });

    const id      = body.id || brdIdFromTicket(ticketId);
    const title   = body.title || `BRD — ${ticket.title}`;
    const status  = body.status || 'Draft';
    const version = body.version || 'v1.0';
    const versions = Array.isArray(body.versions) ? body.versions : [];
    const sections = body.sections && typeof body.sections === 'object' ? body.sections : {};

    // Upsert. Postgres's `on conflict` semantics replace sections/versions
    // wholesale — callers send the new full state each save, which keeps
    // the request/response shape simple.
    const { data, error } = await supabase().from('brds').upsert({
      id, ticket_id: ticketId, title, status, version, sections, versions,
    }, { onConflict: 'id' }).select().single();
    if (error) return json(res, 500, { error: `brd upsert: ${error.message}` });

    // Reflect the link on the ticket so role-scoped views (BrdList, etc.)
    // see this BRD exists. Fire-and-forget — non-fatal if it fails.
    supabase().from('tickets').update({ brd_id: id, brd_status: status }).eq('id', ticketId)
      .then(({ error: te }) => { if (te) console.warn('[brds] ticket link update failed:', te.message); });

    // Append an audit_log row so /tickets/<id> shows the BRD history alongside
    // the ticket's other events.
    supabase().from('audit_log').insert({
      ticket_id:  ticketId,
      actor_id:   actor.id,
      actor_name: actor.name || 'BRD save',
      action:     body.auditAction || 'BRD saved',
      field:      'BRD',
      before_val: null,
      after_val:  `${id} ${version} (${status})`,
      note:       body.auditNote || null,
    }).then(({ error: ae }) => { if (ae) console.warn('[brds] audit insert failed:', ae.message); });

    return json(res, 200, rowToBrd(data));
  }

  json(res, 405, { error: 'Method not allowed' });
}
