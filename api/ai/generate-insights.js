// POST /api/ai/generate-insights        — force a fresh run (Leadership / COE)
// Internally invoked by api/cron/insights.js too.
//
// Builds a metric bundle from the tickets table, sends it to Groq/Gemini,
// parses the structured response, marks previous insights as superseded,
// and inserts the new rows. Returns { run_id, count, provider, model }.

import { supabase, isConfigured } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/http.js';
import * as groq   from './_lib/providers/groq.js';
import * as gemini from './_lib/providers/gemini.js';
import { INSIGHTS_SYSTEM_PROMPT, insightsUserPrompt } from './_lib/prompts.js';
import { insightsMetricBundle } from '../_lib/metrics.js';

export const config = { maxDuration: 30 };

const callProvider = async (provider, providerName, messages) => {
  const resp = await provider.chat({ messages, jsonMode: true, temperature: 0.4, maxTokens: 3000 });
  const msg = resp?.choices?.[0]?.message;
  const text = msg?.content;
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

// Build "previously rejected" themes from feedback for prompt-side
// suppression. Pulls the titles of insights that got >= 2 thumbs-down in
// the last 30 runs. Cheap, only refreshed per cron run.
const fetchRejectedPatterns = async () => {
  try {
    const { data: down } = await supabase()
      .from('insight_feedback')
      .select('insight_id, vote')
      .eq('vote', -1);
    if (!down?.length) return [];
    const counts = {};
    for (const f of down) counts[f.insight_id] = (counts[f.insight_id] || 0) + 1;
    const bad = Object.entries(counts).filter(([_, n]) => n >= 2).map(([id]) => id);
    if (!bad.length) return [];
    const { data: titles } = await supabase()
      .from('insights').select('title').in('id', bad);
    return (titles || []).map((r) => r.title);
  } catch (e) {
    console.warn('[insights] fetchRejectedPatterns failed:', e?.message || e);
    return [];
  }
};

export const runInsights = async () => {
  if (!isConfigured()) throw new Error('Supabase not configured');

  const bundle = await insightsMetricBundle();
  const rejected = await fetchRejectedPatterns();
  const messages = [
    { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
    { role: 'user',   content: insightsUserPrompt(bundle, rejected) },
  ];
  const { provider, model, insights } = await generate(messages);

  // Mark previous as superseded.
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

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
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
