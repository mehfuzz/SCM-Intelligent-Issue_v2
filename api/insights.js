// All insights endpoints merged into a single function to stay under
// Vercel Hobby's 12-function cap. Dispatch by method + body action.
//
//   GET  /api/insights                       → list latest non-superseded
//   POST /api/insights         { action:'refresh' }                → force a fresh AI run
//   POST /api/insights         { insight_id, vote:1|-1, reason? }  → save feedback
//   POST /api/insights?cron=1  (Authorization: Bearer $CRON_SECRET) → nightly cron entrypoint
//
// vercel.json keeps the cron pointed at the friendly /api/cron/insights
// alias via a rewrite, so the schedule URL doesn't need to change.

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';
import * as groq   from './ai/_lib/providers/groq.js';
import * as gemini from './ai/_lib/providers/gemini.js';
import { INSIGHTS_SYSTEM_PROMPT, insightsUserPrompt } from './ai/_lib/prompts.js';
import { insightsMetricBundle } from './_lib/metrics.js';

export const config = { maxDuration: 60 };

// ---------------------------------------------------------------------------
// AI plumbing for refresh / cron
// ---------------------------------------------------------------------------
const callProvider = async (provider, providerName, messages) => {
  const resp = await provider.chat({ messages, jsonMode: true, temperature: 0.4, maxTokens: 3000 });
  const text = resp?.choices?.[0]?.message?.content;
  if (!text) throw new provider.ProviderError(`${providerName} returned empty`, { retryable: true });
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { throw new provider.ProviderError(`${providerName} non-JSON: ${e.message}`, { retryable: true }); }
  if (!parsed || !Array.isArray(parsed.insights)) {
    throw new provider.ProviderError(`${providerName} returned invalid shape`, { retryable: true });
  }
  return { insights: parsed.insights, model: resp?.model };
};

const generate = async (messages) => {
  const attempts = [];
  if (groq.isConfigured()) {
    try { const r = await callProvider(groq, 'groq', messages); return { provider: 'groq', ...r }; }
    catch (e) { attempts.push({ provider: 'groq', message: e.message }); }
  } else attempts.push({ provider: 'groq', message: 'GROQ_API_KEY not set' });
  if (gemini.isConfigured()) {
    try { const r = await callProvider(gemini, 'gemini', messages); return { provider: 'gemini', ...r }; }
    catch (e) { attempts.push({ provider: 'gemini', message: e.message }); }
  } else attempts.push({ provider: 'gemini', message: 'GEMINI_API_KEY not set' });
  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED';
  err.attempts = attempts;
  throw err;
};

const fetchRejectedPatterns = async () => {
  try {
    const { data: down } = await supabase()
      .from('insight_feedback').select('insight_id, vote').eq('vote', -1);
    if (!down?.length) return [];
    const counts = {};
    for (const f of down) counts[f.insight_id] = (counts[f.insight_id] || 0) + 1;
    const bad = Object.entries(counts).filter(([_, n]) => n >= 2).map(([id]) => id);
    if (!bad.length) return [];
    const { data: titles } = await supabase().from('insights').select('title').in('id', bad);
    return (titles || []).map((r) => r.title);
  } catch (e) {
    console.warn('[insights] fetchRejectedPatterns failed:', e?.message || e);
    return [];
  }
};

const runInsights = async () => {
  if (!isConfigured()) throw new Error('Supabase not configured');

  const bundle = await insightsMetricBundle();
  const rejected = await fetchRejectedPatterns();
  const messages = [
    { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
    { role: 'user',   content: insightsUserPrompt(bundle, rejected) },
  ];
  const { provider, model, insights } = await generate(messages);

  await supabase().from('insights').update({ superseded: true }).eq('superseded', false);

  const run_id = crypto.randomUUID();
  const generated_at = new Date().toISOString();
  const rows = insights.slice(0, 10).map((it) => ({
    run_id, generated_at,
    category:             String(it.category || 'hotspot').toLowerCase(),
    title:                String(it.title || '').slice(0, 240) || 'Untitled insight',
    body:                 String(it.body || ''),
    supporting_numbers:   Array.isArray(it.supporting_numbers) ? it.supporting_numbers : [],
    root_cause:           it.root_cause || null,
    recommended_action:   it.recommended_action || null,
    projected_impact_inr: typeof it.projected_impact_inr === 'number' ? it.projected_impact_inr : null,
    cited_ticket_ids:     Array.isArray(it.cited_ticket_ids) ? it.cited_ticket_ids : [],
    impact_score:         Math.max(0, Math.min(100, Number(it.impact_score) || 50)),
  }));
  if (rows.length) {
    const { error } = await supabase().from('insights').insert(rows);
    if (error) throw new Error(`insights insert: ${error.message}`);
  }
  return { run_id, count: rows.length, provider, model };
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  // Cron: invoked as POST /api/insights?cron=1 with Bearer $CRON_SECRET.
  // We also accept GET so a curl with the secret can trigger ad-hoc reruns.
  if (req.query?.cron === '1') {
    const expected = process.env.CRON_SECRET;
    const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (expected && got !== expected) {
      return json(res, 401, { error: 'unauthorized cron invocation' });
    }
    try {
      const out = await runInsights();
      return json(res, 200, { ok: true, ...out });
    } catch (e) {
      return json(res, e?.code === 'AI_ALL_PROVIDERS_FAILED' ? 503 : 500, {
        error: e?.message || String(e), code: e?.code, attempts: e?.attempts,
      });
    }
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase()
      .from('insights').select('*')
      .eq('superseded', false)
      .order('impact_score', { ascending: false });
    if (error) return json(res, 500, { error: error.message });
    const generated_at = data?.[0]?.generated_at || null;
    return json(res, 200, { generated_at, insights: data || [] });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch { return json(res, 400, { error: 'Invalid JSON body' }); }

    // Refresh: manual button on the Insights panel.
    if (body?.action === 'refresh') {
      try {
        const out = await runInsights();
        return json(res, 200, out);
      } catch (e) {
        if (e?.code === 'AI_ALL_PROVIDERS_FAILED') {
          return json(res, 503, { error: 'AI providers unavailable', attempts: e.attempts });
        }
        return json(res, 500, { error: e?.message || String(e) });
      }
    }

    // Feedback (also reachable via the /api/insights/feedback rewrite).
    if (body?.insight_id != null && [1, -1].includes(body.vote)) {
      const actor = requireUser(req);
      const { data, error } = await supabase().from('insight_feedback').insert({
        insight_id: body.insight_id,
        user_id:    actor.id,
        vote:       body.vote,
        reason:     body.reason || null,
      }).select().single();
      if (error) return json(res, 500, { error: error.message });
      return json(res, 201, data);
    }

    return json(res, 400, { error: 'Send { action:"refresh" } or { insight_id, vote }' });
  }

  json(res, 405, { error: 'Method not allowed' });
}
