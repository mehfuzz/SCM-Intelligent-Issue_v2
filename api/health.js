// GET /api/health — sanity check (no Supabase required).

import { handleOptions, json } from './_lib/http.js';
import { isConfigured } from './_lib/supabase.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  json(res, 200, {
    ok: true,
    supabaseConfigured: isConfigured(),
    time: new Date().toISOString(),
  });
}
