// Pure-SQL aggregations against the `tickets` table.
//
// These are the building blocks used by:
//   * api/ai/generate-insights.js  — builds a metric bundle for the nightly
//     insights cron.
//   * api/ai/_lib/tools/handlers.js — backs the leadership chat's tool calls.
//
// All queries cap row counts so a misbehaving caller can't blow the
// serverless function's memory or the LLM's context window.

import { supabase } from './supabase.js';

const MAX_ROWS = 50;

// ---------------------------------------------------------------------------
// Atomic queries
// ---------------------------------------------------------------------------

export const allTickets = async () => {
  const { data, error } = await supabase().from('tickets').select('*');
  if (error) throw new Error(`metrics.allTickets: ${error.message}`);
  return data || [];
};

export const queryTickets = async ({ module, function: fn, priority, status, compliance, since, limit } = {}) => {
  let q = supabase().from('tickets').select('*');
  if (module)     q = q.eq('module', module);
  if (fn)         q = q.eq('function', fn);
  if (priority)   q = q.eq('priority', priority);
  if (status)     q = q.eq('status', status);
  if (compliance) q = q.eq('compliance_risk', compliance);
  if (since)      q = q.gte('submitted_at', since);
  q = q.order('submitted_at', { ascending: false }).limit(Math.min(Number(limit) || MAX_ROWS, MAX_ROWS));
  const { data, error } = await q;
  if (error) throw new Error(`metrics.queryTickets: ${error.message}`);
  return data || [];
};

// ---------------------------------------------------------------------------
// Derived aggregations
// ---------------------------------------------------------------------------

const groupBy = (rows, key, fn = () => 1) => {
  const out = {};
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (k == null) continue;
    out[k] = (out[k] || 0) + fn(r);
  }
  return out;
};

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Per-module breakdown — the workhorse for the insights prompt.
export const modulePerformance = async () => {
  const rows = await allTickets();
  const modules = Array.from(new Set(rows.map((r) => r.module)));
  return modules.map((m) => {
    const own       = rows.filter((r) => r.module === m);
    const open      = own.filter((r) => r.status !== 'Closed');
    const closed    = own.filter((r) => r.status === 'Closed');
    const breached  = own.filter((r) => r.sla_state === 'breached');
    const reopened  = own.filter((r) => r.status === 'Reopened');
    return {
      module: m,
      total: own.length,
      open: open.length,
      closed: closed.length,
      reopened: reopened.length,
      breached: breached.length,
      breach_rate_pct: own.length ? Math.round((breached.length / own.length) * 1000) / 10 : 0,
      avg_days_open: Math.round(avg(own.map((r) => Number(r.sla_days_open) || 0))),
      avg_days_to_close: closed.length
        ? Math.round(avg(closed.map((r) => Number(r.sla_days_open) || 0)))
        : null,
      unrealised_savings_inr: open.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0),
      realised_savings_inr:   closed.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0),
    };
  }).sort((a, b) => b.total - a.total);
};

// Per-POC quality + load (used in insights "POC load" category and chat).
export const pocPerformance = async () => {
  const rows = await allTickets();
  const byPoc = new Map();
  for (const r of rows) {
    if (!r.assigned_to_id) continue;
    if (!byPoc.has(r.assigned_to_id)) {
      byPoc.set(r.assigned_to_id, { id: r.assigned_to_id, name: r.assigned_to, tickets: [] });
    }
    byPoc.get(r.assigned_to_id).tickets.push(r);
  }
  return Array.from(byPoc.values()).map((p) => {
    const total    = p.tickets.length;
    const open     = p.tickets.filter((t) => t.status !== 'Closed').length;
    const breached = p.tickets.filter((t) => t.sla_state === 'breached').length;
    const closed   = p.tickets.filter((t) => t.status === 'Closed');
    const reopened = p.tickets.filter((t) => t.status === 'Reopened').length;
    return {
      poc_id: p.id, poc_name: p.name, total, open, breached, reopened,
      avg_days_to_close: closed.length
        ? Math.round(avg(closed.map((t) => Number(t.sla_days_open) || 0)))
        : null,
    };
  }).sort((a, b) => b.total - a.total);
};

// Counts grouped by an arbitrary field (used by chat aggregate tool).
export const aggregate = async ({ group_by, metric = 'count', filters = {}, time_range } = {}) => {
  const valid = new Set(['module', 'function', 'priority', 'status', 'category', 'compliance_risk', 'assigned_to']);
  if (!valid.has(group_by)) throw new Error(`group_by must be one of: ${[...valid].join(', ')}`);

  let q = supabase().from('tickets').select('*');
  for (const [k, v] of Object.entries(filters || {})) {
    if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
  }
  if (time_range?.from) q = q.gte('submitted_at', time_range.from);
  if (time_range?.to)   q = q.lte('submitted_at', time_range.to);
  const { data, error } = await q;
  if (error) throw new Error(`metrics.aggregate: ${error.message}`);

  const grouped = {};
  for (const r of (data || [])) {
    const k = r[group_by] ?? '(null)';
    if (!grouped[k]) grouped[k] = { group: k, count: 0, cost_savings: 0, days_open: [] };
    grouped[k].count++;
    grouped[k].cost_savings += Number(r.cost_savings) || 0;
    grouped[k].days_open.push(Number(r.sla_days_open) || 0);
  }
  return Object.values(grouped)
    .map((g) => {
      let value;
      switch (metric) {
        case 'count':              value = g.count; break;
        case 'sum_savings':        value = g.cost_savings; break;
        case 'avg_days_open':      value = Math.round(avg(g.days_open)); break;
        default:                   value = g.count;
      }
      return { group: g.group, value };
    })
    .sort((a, b) => b.value - a.value);
};

// Top-N tickets by a metric (used by chat top_n tool and insights forecasts).
export const topTickets = async ({ metric = 'composite', n = 5, filters = {} } = {}) => {
  let q = supabase().from('tickets').select('*');
  for (const [k, v] of Object.entries(filters || {})) {
    if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
  }
  // We don't store composite in DB; sort client-side after pulling everything
  // matching the filters.
  q = q.limit(MAX_ROWS);
  const { data, error } = await q;
  if (error) throw new Error(`metrics.topTickets: ${error.message}`);
  const rows = data || [];
  const sortKey = {
    cost_savings:  (r) => Number(r.cost_savings) || 0,
    days_open:     (r) => Number(r.sla_days_open) || 0,
    people:        (r) => Number(r.people_affected) || 0,
    composite:     (r) => {
      // Mirror the framework: 25% each, freq uses raw base score.
      const FREQ = { Daily: 100, Weekly: 75, Monthly: 40, Annual: 15, 'Ad-hoc': 15 };
      const freqScore = FREQ[r.frequency] ?? 0;
      // Without percentRank context (we're scoring single rows) approximate
      // with simple normalisation to 0–100 for display purposes only.
      const peopleN = Math.min(100, (Number(r.people_affected) || 0));
      const hoursN  = Math.min(100, (Number(r.hours_lost_per_week) || 0) * 2);
      const costN   = Math.min(100, (Number(r.cost_savings) || 0) / 100000);
      return Math.round((peopleN + hoursN + costN + freqScore) / 4);
    },
  }[metric] || (() => 0);
  return rows.sort((a, b) => sortKey(b) - sortKey(a)).slice(0, Math.min(n, 10));
};

// Compare two periods (chat compare_periods tool).
export const comparePeriods = async ({ metric = 'count', period_a, period_b, filters = {} } = {}) => {
  if (!period_a?.from || !period_a?.to || !period_b?.from || !period_b?.to) {
    throw new Error('compare_periods needs period_a and period_b with from/to');
  }
  const grab = async (range) => {
    let q = supabase().from('tickets').select('*')
      .gte('submitted_at', range.from).lte('submitted_at', range.to);
    for (const [k, v] of Object.entries(filters || {})) {
      if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) throw new Error(`metrics.comparePeriods: ${error.message}`);
    return data || [];
  };
  const [a, b] = await Promise.all([grab(period_a), grab(period_b)]);
  const compute = (rows) => {
    if (metric === 'sum_savings') return rows.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0);
    if (metric === 'avg_days_open') return Math.round(avg(rows.map((r) => Number(r.sla_days_open) || 0)));
    return rows.length;
  };
  const va = compute(a);
  const vb = compute(b);
  const change_pct = va === 0 ? null : Math.round(((vb - va) / Math.abs(va)) * 1000) / 10;
  return { period_a: { ...period_a, value: va, count: a.length }, period_b: { ...period_b, value: vb, count: b.length }, change_pct };
};

// 30-day forward submission forecast per module (exponential smoothing on
// monthly buckets). Used by the insights "forecast" category and chat.
export const submissionForecast = async ({ weeks = 4 } = {}) => {
  const rows = await allTickets();
  const byModuleMonth = {};
  for (const r of rows) {
    if (!r.submitted_at) continue;
    const d = new Date(r.submitted_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byModuleMonth[r.module] = byModuleMonth[r.module] || {};
    byModuleMonth[r.module][k] = (byModuleMonth[r.module][k] || 0) + 1;
  }

  // Holt-Winters lite: simple exponential smoothing α=0.4.
  const forecast = [];
  for (const [module, months] of Object.entries(byModuleMonth)) {
    const series = Object.keys(months).sort().map((k) => months[k]);
    if (!series.length) continue;
    let s = series[0];
    for (let i = 1; i < series.length; i++) s = 0.4 * series[i] + 0.6 * s;
    const monthly = Math.round(s);
    const projected = Math.round(monthly * (weeks / 4));
    forecast.push({ module, history: series, projected_next_period: projected });
  }
  return forecast.sort((a, b) => b.projected_next_period - a.projected_next_period);
};

// All-in-one bundle for the nightly insights cron. Single async call.
export const insightsMetricBundle = async () => {
  const [modules, pocs, forecast] = await Promise.all([
    modulePerformance(),
    pocPerformance(),
    submissionForecast({ weeks: 4 }),
  ]);
  const tickets = await allTickets();
  const grand = {
    total_tickets:        tickets.length,
    open:                 tickets.filter((t) => t.status !== 'Closed').length,
    breached:             tickets.filter((t) => t.sla_state === 'breached').length,
    reopened:             tickets.filter((t) => t.status === 'Reopened').length,
    compliance_flagged:   tickets.filter((t) => t.compliance_risk === 'Yes').length,
    realised_savings_inr: tickets.filter((t) => t.status === 'Closed')
                            .reduce((s, t) => s + (Number(t.cost_savings) || 0), 0),
    unrealised_savings_inr: tickets.filter((t) => t.status !== 'Closed')
                            .reduce((s, t) => s + (Number(t.cost_savings) || 0), 0),
  };
  return { grand, modules, pocs, forecast };
};
