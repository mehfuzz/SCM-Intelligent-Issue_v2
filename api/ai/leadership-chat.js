// Leadership chat API — sessions list, messages, and chat turns.
//
//   GET  /api/ai/leadership-chat                       → list this user's sessions
//   GET  /api/ai/leadership-chat?session_id=<uuid>     → messages for that session
//   POST /api/ai/leadership-chat                       → { session_id?, message } → reply

import { query, execute, isConfigured, randomUUID } from '../_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { chatComplete } from './_lib/chat-orchestrator.js';
import { CHAT_SYSTEM_PROMPT } from './_lib/prompts.js';

export const config = { maxDuration: 45 };

const loadHistory = async (sessionId) => {
  const data = await query(
    `SELECT * FROM chat_messages WHERE session_id = :sid ORDER BY at ASC`,
    { sid: sessionId }
  );
  const msgs = [];
  for (const r of data) {
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
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.method === 'GET') {
    const actor = requireUser(req);
    const { session_id } = req.query;
    try {
      if (session_id) {
        const rows = await query(
          `SELECT * FROM chat_messages WHERE session_id = :sid ORDER BY at ASC`,
          { sid: session_id }
        );
        return json(res, 200, rows);
      }
      const rows = actor.id
        ? await query(
            `SELECT * FROM chat_sessions WHERE user_id = :uid ORDER BY updated_at DESC FETCH FIRST 50 ROWS ONLY`,
            { uid: actor.id }
          )
        : await query(
            `SELECT * FROM chat_sessions ORDER BY updated_at DESC FETCH FIRST 50 ROWS ONLY`, {}
          );
      return json(res, 200, rows);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const actor = requireUser(req);
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const userText = String(body?.message || '').trim();
  if (!userText) return json(res, 400, { error: 'message required' });

  try {
    let sessionId = body?.session_id || null;
    if (!sessionId) {
      sessionId = randomUUID();
      await execute(
        `INSERT INTO chat_sessions (id, user_id, title) VALUES (:id, :user_id, :title)`,
        { id: sessionId, user_id: actor.id || null, title: userText.slice(0, 80) }
      );
    }

    await execute(
      `INSERT INTO chat_messages (id, session_id, role, content) VALUES (:id, :sid, :role, :content)`,
      { id: randomUUID(), sid: sessionId, role: 'user', content: userText }
    );

    const history = await loadHistory(sessionId);
    const messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...history];

    let out;
    try { out = await chatComplete({ messages }); }
    catch (e) {
      if (e?.code === 'AI_ALL_PROVIDERS_FAILED')
        return json(res, 503, { session_id: sessionId, error: 'AI providers unavailable', attempts: e.attempts });
      return json(res, 500, { session_id: sessionId, error: e?.message || String(e) });
    }

    for (const t of out.toolTrace) {
      await execute(
        `INSERT INTO chat_messages (id, session_id, role, tool_name, tool_args, tool_result, provider, model)
         VALUES (:id, :sid, :role, :tool_name, :tool_args, :tool_result, :provider, :model)`,
        {
          id: randomUUID(), sid: sessionId, role: 'tool',
          tool_name: t.name, tool_args: JSON.stringify(t.args), tool_result: JSON.stringify(t.result),
          provider: out.provider, model: out.model,
        }
      );
    }
    await execute(
      `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, provider, model)
       VALUES (:id, :sid, :role, :content, :tool_calls, :provider, :model)`,
      {
        id: randomUUID(), sid: sessionId, role: 'assistant',
        content: out.message?.content || '',
        tool_calls: JSON.stringify(Array.isArray(out.message?.tool_calls) ? out.message.tool_calls : []),
        provider: out.provider, model: out.model,
      }
    );

    return json(res, 200, {
      session_id: sessionId,
      reply:      out.message?.content || '',
      toolTrace:  out.toolTrace,
      provider:   out.provider,
      model:      out.model,
    });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
