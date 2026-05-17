// Vercel cron entrypoint. Runs nightly (see vercel.json).
//
// Auth: Vercel attaches an Authorization header derived from CRON_SECRET
// when invoking scheduled cron functions. Check against that to keep this
// endpoint from being callable by random visitors.

import { runInsights } from '../ai/generate-insights.js';
import { handleOptions, json } from '../_lib/http.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const expected = process.env.CRON_SECRET;
  const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (expected && got !== expected) {
    return json(res, 401, { error: 'unauthorized cron invocation' });
  }

  try {
    const out = await runInsights();
    return json(res, 200, { ok: true, ...out });
  } catch (e) {
    console.error('[cron/insights] failed:', e?.message || e);
    return json(res, 500, { error: e?.message || String(e), code: e?.code, attempts: e?.attempts });
  }
}
