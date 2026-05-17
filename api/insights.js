// GET   /api/insights                  → latest non-superseded insights (+ a freshness timestamp)
// POST  /api/insights/feedback         → { insight_id, vote: 1|-1, reason? }
//
// (The "force regenerate now" button on the UI hits /api/ai/generate-insights
// directly — kept separate so the POST surface here is feedback-only.)

import { supabase, isConfigured } from './_lib/supabase.js';
import { handleOptions, json, readBody, requireUser } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!isConfigured()) return json(res, 500, { error: 'Supabase env vars not configured' });

  if (req.method === 'GET') {
    // Latest run only — ordered by impact_score desc.
    const { data, error } = await supabase()
      .from('insights')
      .select('*')
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

    // Only one POST route: /api/insights/feedback (URL-rewritten by Vercel
    // since /api/insights/* all map here).
    if (!body.insight_id || ![1, -1].includes(body.vote)) {
      return json(res, 400, { error: 'insight_id and vote in (1,-1) required' });
    }
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

  json(res, 405, { error: 'Method not allowed' });
}
