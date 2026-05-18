// GET  /api/insights                        → list latest insights
// POST /api/insights { action:'refresh' }   → force AI run
// POST /api/insights { insight_id, vote }   → save feedback
// POST /api/insights?cron=1                 → nightly cron

import { query, execute, insertMany, isConfigured, randomUUID } from './_lib/oracle.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';
import * as groq   from './ai/_lib/providers/groq.js';
import * as gemini from './ai/_lib/providers/gemini.js';
import { INSIGHTS_SYSTEM_PROMPT, insightsUserPrompt } from './ai/_lib/prompts.js';
import { insightsMetricBundle } from './_lib/metrics.js';

export const config = { maxDuration: 60 };

const callProvider = async (provider, providerName, messages) => {
  const resp = await provider.chat({ messages, jsonMode: true, temperature: 0.4, maxTokens: 3000 });
  const text = resp?.choices?.[0]?.message?.content;
  if (!text) throw new provider.ProviderError(`${providerName} returned empty`, { retryable: true });
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { throw new provider.ProviderError(`${providerName} non-JSON: ${e.message}`, { retryable: true }); }
  if (!parsed || !Array.isArray(parsed.insights))
    throw new provider.ProviderError(`${providerName} returned invalid shape`, { retryable: true });
  return { insights: parsed.insights, model: resp?.model };
};

const generate = async (messages) => {
  const attempts = [];
  if (groq.isConfigured()) {
    try { return { provider: 'groq', ...(await callProvider(groq, 'groq', messages)) }; }
    catch (e) { attempts.push({ provider: 'groq', message: e.message }); }
  } else attempts.push({ provider: 'groq', message: 'GROQ_API_KEY not set' });
  if (gemini.isConfigured()) {
    try { return { provider: 'gemini', ...(await callProvider(gemini, 'gemini', messages)) }; }
    catch (e) { attempts.push({ provider: 'gemini', message: e.message }); }
  } else attempts.push({ provider: 'gemini', message: 'GEMINI_API_KEY not set' });
  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED'; err.attempts = attempts;
  throw err;
};

const fetchRejectedPatterns = async () => {
  try {
    const down = await query(`SELECT insight_id, vote FROM insight_feedback WHERE vote = -1`, {});
    if (!down.length) return [];
    const counts = {};
    for (const f of down) counts[f.insight_id] = (counts[f.insight_id] || 0) + 1;
    const bad = Object.entries(counts).filter(([, n]) => n >= 2).map(([id]) => id);
    if (!bad.length) return [];
    const rows = await query(
      `SELECT title FROM insights WHERE id IN (${bad.map((_, i) => `:id${i}`).join(',')})`,
      Object.fromEntries(bad.map((id, i) => [`id${i}`, id]))
    );
    return rows.map((r) => r.title);
  } catch (e) {
    console.warn('[insights] fetchRejectedPatterns failed:', e?.message || e);
    return [];
  }
};

const runInsights = async () => {
  if (!isConfigured()) throw new Error('Oracle DB not configured');
  const bundle   = await insightsMetricBundle();
  const rejected = await fetchRejectedPatterns();
  const messages = [
    { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
    { role: 'user',   content: insightsUserPrompt(bundle, rejected) },
  ];
  const { provider, model, insights } = await generate(messages);

  await execute(`UPDATE insights SET superseded = 1 WHERE superseded = 0`, {});

  const run_id      = randomUUID();
  const generated_at = new Date().toISOString();
  const rows = insights.slice(0, 10).map((it) => ({
    id:                   randomUUID(),
    run_id,
    generated_at,
    category:             String(it.category || 'hotspot').toLowerCase(),
    title:                String(it.title || '').slice(0, 240) || 'Untitled insight',
    body:                 String(it.body || ''),
    supporting_numbers:   JSON.stringify(Array.isArray(it.supporting_numbers) ? it.supporting_numbers : []),
    root_cause:           it.root_cause || null,
    recommended_action:   it.recommended_action || null,
    projected_impact_inr: typeof it.projected_impact_inr === 'number' ? it.projected_impact_inr : null,
    cited_ticket_ids:     JSON.stringify(Array.isArray(it.cited_ticket_ids) ? it.cited_ticket_ids : []),
    impact_score:         Math.max(0, Math.min(100, Number(it.impact_score) || 50)),
    superseded:           0,
  }));
  if (rows.length) await insertMany('insights', rows);
  return { run_id, count: rows.length, provider, model };
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Oracle env vars not configured' });

  if (req.query?.cron === '1') {
    const expected = process.env.CRON_SECRET;
    const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (expected && got !== expected) return json(res, 401, { error: 'unauthorized cron invocation' });
    try { return json(res, 200, { ok: true, ...(await runInsights()) }); }
    catch (e) {
      return json(res, e?.code === 'AI_ALL_PROVIDERS_FAILED' ? 503 : 500,
        { error: e?.message || String(e), code: e?.code, attempts: e?.attempts });
    }
  }

  if (req.method === 'GET') {
    try {
      const rows = await query(
        `SELECT * FROM insights WHERE superseded = 0 ORDER BY impact_score DESC`, {}
      );
      const generated_at = rows[0]?.generated_at || null;
      return json(res, 200, { generated_at, insights: rows });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }

    if (body?.action === 'refresh') {
      try { return json(res, 200, await runInsights()); }
      catch (e) {
        if (e?.code === 'AI_ALL_PROVIDERS_FAILED')
          return json(res, 503, { error: 'AI providers unavailable', attempts: e.attempts });
        return json(res, 500, { error: e?.message || String(e) });
      }
    }

    if (body?.insight_id != null && [1, -1].includes(body.vote)) {
      const actor = requireUser(req);
      const id = randomUUID();
      try {
        await execute(
          `INSERT INTO insight_feedback (id, insight_id, user_id, vote, reason)
           VALUES (:id, :insight_id, :user_id, :vote, :reason)`,
          { id, insight_id: body.insight_id, user_id: actor.id || null,
            vote: body.vote, reason: body.reason || null }
        );
        const [row] = await query(`SELECT * FROM insight_feedback WHERE id = :id`, { id });
        return json(res, 201, row);
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    }

    return json(res, 400, { error: 'Send { action:"refresh" } or { insight_id, vote }' });
  }

  json(res, 405, { error: 'Method not allowed' });
}
