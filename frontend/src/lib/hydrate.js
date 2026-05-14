// Loads remote data into the in-memory MOCK_* arrays exported by mockData.js,
// so existing pages keep working without rewriting their reads. Pages that
// take snapshots via `useState(MOCK_TICKETS)` will see the hydrated data
// because hydration completes BEFORE the first page renders.

import * as mock from '../data/mockData';
import { api, fetchHealth } from './api';

const replace = (arr, items) => {
  if (!Array.isArray(arr) || !Array.isArray(items)) return;
  arr.length = 0;
  for (const item of items) arr.push(item);
};

const replaceObject = (target, src) => {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, src || {});
};

// Module-scoped flag so non-React code (writes) can check whether to attempt
// API persistence. Reads inside React components should still use the
// useDataMode() hook from DataMode.jsx for re-rendering.
let _liveApi = false;
export const isLiveApi = () => _liveApi;

export const hydrateFromApi = async () => {
  const health = await fetchHealth();
  const available = Boolean(
    health?.ok && health?.supabaseConfigured && health?.dbReachable && health?.schemaApplied
  );

  if (!available) {
    _liveApi = false;
    return { available: false, health };
  }

  try {
    const [users, tickets] = await Promise.all([
      api.listUsers(),
      api.listTickets(),
    ]);

    replace(mock.MOCK_USERS,   users   || []);
    replace(mock.MOCK_TICKETS, tickets || []);

    // Re-run the priority decoration step so MOCK_TICKETS rows pick up
    // composite/tier/rank that the seed-time helper computed for the
    // built-in dataset.
    if (mock.MOCK_TICKETS.length && typeof mock.linearRank === 'function') {
      const ranked = mock.linearRank(mock.MOCK_TICKETS);
      for (const t of mock.MOCK_TICKETS) {
        const r = ranked.find((x) => x.id === t.id);
        if (!r) continue;
        t.priority  = r.tier;
        t.scores    = r.scores;
        t.composite = r.scores.composite;
        t.rank      = r.rank;
      }
    }

    // Comments / audit / notifications are loaded lazily per ticket — the
    // page-level fetchers in api.js handle that. We empty the mock objects
    // here so stale baked-in entries don't bleed into the live data.
    replaceObject(mock.MOCK_COMMENTS, {});
    replaceObject(mock.MOCK_AUDIT,    {});
    replace(mock.MOCK_NOTIFICATIONS, []);

    _liveApi = true;
    return { available: true, health };
  } catch (err) {
    console.warn('[hydrate] API hydration failed; falling back to bundled mocks.', err);
    _liveApi = false;
    return { available: false, error: err, health };
  }
};
