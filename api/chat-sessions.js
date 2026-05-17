// GET /api/chat-sessions                      → list this user's sessions
// GET /api/chat-sessions?id=<uuid>             → messages for that session

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const actor = requireUser(req);
  const { id } = req.query;

  if (id) {
    const { data, error } = await supabase()
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('at', { ascending: true });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, data || []);
  }

  let q = supabase().from('chat_sessions').select('*').order('updated_at', { ascending: false }).limit(50);
  if (actor.id) q = q.eq('user_id', actor.id);
  const { data, error } = await q;
  if (error) return json(res, 500, { error: error.message });
  json(res, 200, data || []);
}
