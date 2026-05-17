// Tool-call handlers. Each receives the model's args, calls the matching
// metrics function, and returns a JSON-serialisable result. Failures are
// caught and returned as { error } so the model can adapt rather than the
// request hard-failing.

import * as metrics from '../../../_lib/metrics.js';

const safe = async (fn, args) => {
  try { return await fn(args); }
  catch (e) { return { error: e?.message || String(e) }; }
};

export const TOOL_HANDLERS = {
  query_tickets:    (args) => safe(metrics.queryTickets, args),
  aggregate:        (args) => safe(metrics.aggregate, args),
  top_n:            (args) => safe(metrics.topTickets, args),
  compare_periods:  (args) => safe(metrics.comparePeriods, args),
  forecast:         (args) => safe(metrics.submissionForecast, args),
  // `chart` is the only tool whose handler is identity — the UI consumes
  // the spec directly. We trim oversize data arrays for safety.
  chart: async (args = {}) => {
    const data = Array.isArray(args.data) ? args.data.slice(0, 50) : [];
    return {
      type:   args.type || 'bar',
      title:  args.title || '',
      data,
      x_key:  args.x_key  || 'name',
      y_keys: Array.isArray(args.y_keys) && args.y_keys.length ? args.y_keys : ['value'],
    };
  },
};

export const dispatch = async (name, args) => {
  const fn = TOOL_HANDLERS[name];
  if (!fn) return { error: `unknown tool: ${name}` };
  return fn(args || {});
};
