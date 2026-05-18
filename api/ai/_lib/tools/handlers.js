// Tool-call handlers. Each receives the model's args, calls the matching
// metrics function, and returns a JSON-serialisable result. Failures are
// caught and returned as { error } so the model can adapt rather than the
// request hard-failing.
//
// We coerce string-shaped integers (Llama-on-Groq sometimes emits `"5"`)
// into real numbers before passing them down. The schemas tolerate both
// shapes already (`oneOf:[integer,string]`); the coercion keeps the
// downstream metric functions strict.

import * as metrics from '../../../_lib/metrics.js';

const toInt = (v, fallback) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^[0-9]+$/.test(v)) return parseInt(v, 10);
  return fallback;
};

const normalize = (name, args) => {
  const a = { ...(args || {}) };
  if (name === 'query_tickets')   { a.limit = toInt(a.limit, 25); }
  else if (name === 'top_n')      { a.n     = toInt(a.n, 5); }
  else if (name === 'forecast')   { a.weeks = toInt(a.weeks, 4); }
  return a;
};

const safe = async (fn, args) => {
  try { return await fn(args); }
  catch (e) { return { error: e?.message || String(e) }; }
};

export const TOOL_HANDLERS = {
  query_tickets:    (args) => safe(metrics.queryTickets,      normalize('query_tickets', args)),
  aggregate:        (args) => safe(metrics.aggregate,         args),
  top_n:            (args) => safe(metrics.topTickets,        normalize('top_n', args)),
  compare_periods:  (args) => safe(metrics.comparePeriods,    args),
  forecast:         (args) => safe(metrics.submissionForecast, normalize('forecast', args)),
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
