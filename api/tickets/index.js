// GET  /api/tickets          → list (optionally scoped by ?role/?user_id)
// POST /api/tickets          → create a new ticket

import { supabase, isConfigured } from '../_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { rowToTicket, ticketToRow } from '../_lib/mappers.js';
import { computeScoresAndTier } from '../_lib/priority.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') return listTickets(req, res);
  if (req.method === 'POST') return createTicket(req, res);
  return json(res, 405, { error: 'Method not allowed' });
}

async function listTickets(req, res) {
  const { role, user_id } = req.query;
  let query = supabase().from('tickets').select('*').order('submitted_at', { ascending: false });

  if (role === 'Submitter' && user_id) {
    query = query.eq('submitted_by_id', user_id);
  } else if (role === 'POC Owner' && user_id) {
    query = query.eq('assigned_to_id', user_id);
  }

  const { data, error } = await query;
  if (error) return json(res, 500, { error: error.message });
  json(res, 200, (data || []).map(rowToTicket));
}

async function createTicket(req, res) {
  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  // Generate a framework-style ticket ID: SCM-{MODULE_3}-{NNN}
  const modCode = (body.module || 'XXX').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const { data: existing } = await supabase()
    .from('tickets')
    .select('id')
    .like('id', `SCM-${modCode}-%`);
  const nextNum = String((existing?.length || 0) + 1).padStart(3, '0');
  const id = `SCM-${modCode}-${nextNum}`;

  // Pull all tickets so we can compute percentile scores including this new one.
  const { data: all } = await supabase().from('tickets').select('*');
  const candidateRow = {
    ...ticketToRow({
      ...body,
      id,
      submittedBy: actor.name,
      submittedById: actor.id,
      submittedAt: new Date().toISOString(),
      status: 'Submitted',
      assignedTo: null,
      assignedToId: null,
    }),
  };
  const scores = computeScoresAndTier(candidateRow, [...(all || []), candidateRow]);
  candidateRow.priority = scores.tier;

  const { data, error } = await supabase()
    .from('tickets')
    .insert(candidateRow)
    .select()
    .single();
  if (error) return json(res, 500, { error: error.message });

  // Initial audit entries
  await supabase().from('audit_log').insert([
    {
      ticket_id: id, actor_id: actor.id, actor_name: actor.name,
      action: 'Issue submitted', field: null, before_val: null, after_val: null,
    },
    {
      ticket_id: id, actor_id: null, actor_name: 'System',
      action: scores.tier === 'P0' ? 'Priority Zero Override' : 'Auto-prioritisation',
      field: 'Priority', before_val: null, after_val: scores.tier,
    },
  ]);

  json(res, 201, rowToTicket(data));
}
