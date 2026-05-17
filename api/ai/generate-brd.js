// POST /api/ai/generate-brd  { ticketId }
//
// 1. Loads the ticket from Supabase (so the prompt sees authoritative
//    field values, not whatever the client claims).
// 2. Calls the LLM orchestrator (Groq → Gemini fallback).
// 3. Writes a row to audit_log: who clicked Generate, which provider/model
//    actually answered, and timestamp. The frontend also renders this in
//    the BRD editor's audit pane.
// 4. Returns the 6 BRD sections + meta { provider, model, fallbackUsed, at }.
//
// If both providers fail, returns 503 with a clear `attempts` array so the
// UI can show exactly which provider failed for what reason.

import { supabase, isConfigured as supabaseConfigured } from '../_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from '../_lib/http.js';
import { rowToTicket } from '../_lib/mappers.js';
import { generateBrd } from './_lib/llm.js';
import { SYSTEM_PROMPT, userPromptFor } from './_lib/prompts.js';

// Vercel function config — give the chain room to fall back on Pro plans.
// Hobby caps to 10s regardless; the orchestrator's 8s per-provider timeout
// keeps even Hobby usable.
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  const ticketId = body?.ticketId;
  if (!ticketId) return json(res, 400, { error: 'ticketId required' });

  const actor = requireUser(req);

  // -----------------------------------------------------------------------
  // 1. Load the ticket
  // -----------------------------------------------------------------------
  let ticket = body?.ticket || null;
  if (supabaseConfigured()) {
    try {
      const { data, error } = await supabase()
        .from('tickets').select('*').eq('id', ticketId).single();
      if (error) {
        return json(res, 404, { error: `Ticket not found: ${error.message}` });
      }
      ticket = rowToTicket(data);
    } catch (e) {
      return json(res, 500, { error: `Failed to load ticket: ${e?.message || e}` });
    }
  } else if (!ticket) {
    // Demo mode and the client didn't ship the ticket — we can't proceed.
    return json(res, 400, {
      error: 'Supabase not configured and no ticket payload provided',
    });
  }

  // -----------------------------------------------------------------------
  // 2. Call the LLM orchestrator
  // -----------------------------------------------------------------------
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt   = userPromptFor(ticket);

  let result;
  try {
    result = await generateBrd({ systemPrompt, userPrompt });
  } catch (e) {
    if (e?.code === 'AI_ALL_PROVIDERS_FAILED') {
      return json(res, 503, {
        error: 'AI providers unavailable',
        attempts: e.attempts,
        hint: 'Set GROQ_API_KEY and/or GEMINI_API_KEY in Vercel project settings, then redeploy.',
      });
    }
    return json(res, 500, { error: e?.message || String(e) });
  }

  // -----------------------------------------------------------------------
  // 3. Audit
  // -----------------------------------------------------------------------
  const generatedAt = new Date().toISOString();
  if (supabaseConfigured()) {
    try {
      await supabase().from('audit_log').insert({
        ticket_id:  ticketId,
        at:         generatedAt,
        actor_id:   actor.id,
        actor_name: actor.name || 'AI request',
        action:     'AI BRD draft generated',
        field:      'BRD',
        before_val: null,
        after_val:  `${result.provider}:${result.model}${result.fallbackUsed ? ' (fallback)' : ''}`,
        note:       'Auto-drafted via /api/ai/generate-brd',
      });
    } catch (e) {
      // Don't fail the request if audit insert fails — log and continue.
      console.warn('[generate-brd] audit insert failed:', e?.message || e);
    }
  }

  // -----------------------------------------------------------------------
  // 4. Respond
  // -----------------------------------------------------------------------
  json(res, 200, {
    sections: result.sections,
    meta: {
      provider:     result.provider,
      model:        result.model,
      fallbackUsed: result.fallbackUsed,
      at:           generatedAt,
      actor:        actor.name || null,
    },
  });
}
