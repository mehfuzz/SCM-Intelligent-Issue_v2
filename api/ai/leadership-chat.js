// Leadership chat API — merged with chat-sessions to stay under Vercel
// Hobby's 12-function cap.
//
//   GET  /api/ai/leadership-chat                       → list this user's sessions
//   GET  /api/ai/leadership-chat?session_id=<uuid>     → messages for that session
//   POST /api/ai/leadership-chat                       → { session_id?, message } → reply

import { supabase, isConfigured } from '../_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { chatComplete } from './_lib/chat-orchestrator.js';
import { CHAT_SYSTEM_PROMPT } from './_lib/prompts.js';

export const config = { maxDuration: 45 };

const loadHistory = async (sessionId) => {
  const { data, error } = await supabase()
    .from('chat_messages').select('*')
    .eq('session_id', sessionId).order('at', { ascending: true });
  if (error) throw new Error(`load history: ${error.message}`);
  const msgs = [];
  for (const r of (data || [])) {
    if (r.role === 'tool') {
      msgs.push({ role: 'tool', tool_call_id: r.tool_name + ':' + r.id, name: r.tool_name, content: JSON.stringify(r.tool_result || {}) });
    } else if (r.role === 'assistant' && Array.isArray(r.tool_calls) && r.tool_calls.length) {
      msgs.push({ role: 'assistant', content: r.content || '', tool_calls: r.tool_calls });
    } else {
      msgs.push({ role: r.role, content: r.content || '' });
    }
  }
  return msgs;
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  // --- GET: sessions list or one session's messages ---
  if (req.method === 'GET') {
    const actor = requireUser(req);
    const { session_id } = req.query;
    if (session_id) {
      const { data, error } = await supabase()
        .from('chat_messages').select('*')
        .eq('session_id', session_id).order('at', { ascending: true });
      if (error) return json(res, 500, { error: error.message });
      return json(res, 200, data || []);
    }
    let q = supabase().from('chat_sessions').select('*').order('updated_at', { ascending: false }).limit(50);
    if (actor.id) q = q.eq('user_id', actor.id);
    const { data, error } = await q;
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, data || []);
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  // --- POST: chat turn ---
  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const userText = String(body?.message || '').trim();
  if (!userText) return json(res, 400, { error: 'message required' });

  let sessionId = body?.session_id || null;
  if (!sessionId) {
    const { data, error } = await supabase().from('chat_sessions').insert({
      user_id: actor.id,
      title:   userText.slice(0, 80),
    }).select().single();
    if (error) return json(res, 500, { error: `create session: ${error.message}` });
    sessionId = data.id;
  }

  await supabase().from('chat_messages').insert({
    session_id: sessionId, role: 'user', content: userText,
  });

  let history;
  try { history = await loadHistory(sessionId); }
  catch (e) { return json(res, 500, { error: e.message }); }
  const messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...history];

  let out;
  try { out = await chatComplete({ messages }); }
  catch (e) {
    if (e?.code === 'AI_ALL_PROVIDERS_FAILED') {
      return json(res, 503, { session_id: sessionId, error: 'AI providers unavailable', attempts: e.attempts });
    }
    return json(res, 500, { session_id: sessionId, error: e?.message || String(e) });
  }

  for (const t of out.toolTrace) {
    await supabase().from('chat_messages').insert({
      session_id: sessionId,
      role:       'tool',
      tool_name:  t.name,
      tool_args:  t.args,
      tool_result: t.result,
      provider:   out.provider,
      model:      out.model,
    });
  }
  await supabase().from('chat_messages').insert({
    session_id: sessionId,
    role:       'assistant',
    content:    out.message?.content || '',
    tool_calls: Array.isArray(out.message?.tool_calls) ? out.message.tool_calls : [],
    provider:   out.provider,
    model:      out.model,
  });

  return json(res, 200, {
    session_id: sessionId,
    reply:      out.message?.content || '',
    toolTrace:  out.toolTrace,
    provider:   out.provider,
    model:      out.model,
  });
}
