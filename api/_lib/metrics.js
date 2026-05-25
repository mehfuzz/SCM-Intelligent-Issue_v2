// Pure aggregations against the tickets table, used by insights cron + chat tools.

import { query } from './oracle.js';

const MAX_ROWS = 50;

export const allTickets = async () => {
  return query(`SELECT * FROM tickets`, {});
};

export const queryTickets = async ({ module, function: fn, priority, status, compliance, since, limit } = {}) => {
  const where = [];
  const binds = {};
  if (module)     { where.push('module = :module');              binds.module = module; }
  if (fn)         { where.push('function = :fn');                binds.fn = fn; }
  if (priority)   { where.push('priority = :priority');          binds.priority = priority; }
  if (status)     { where.push('status = :status');              binds.status = status; }
  if (compliance) { where.push('compliance_risk = :compliance'); binds.compliance = compliance; }
  if (since)      { where.push('submitted_at >= :since');        binds.since = since; }
  const lim = Math.min(Number(limit) || MAX_ROWS, MAX_ROWS);
  const sql = `SELECT * FROM tickets${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
               ORDER BY submitted_at DESC FETCH FIRST :lim ROWS ONLY`;
  return query(sql, { ...binds, lim });
};

// ---------------------------------------------------------------------------
// Derived aggregations (same logic as before — pure JS after fetch)
// ---------------------------------------------------------------------------

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const modulePerformance = async () => {
  const rows = await allTickets();
  const modules = Array.from(new Set(rows.map((r) => r.module)));
  return modules.map((m) => {
    const own      = rows.filter((r) => r.module === m);
    const open     = own.filter((r) => r.status !== 'Closed');
    const closed   = own.filter((r) => r.status === 'Closed');
    const breached = own.filter((r) => r.sla_state === 'breached');
    const reopened = own.filter((r) => r.status === 'Reopened');
    return {
      module: m, total: own.length, open: open.length, closed: closed.length,
      reopened: reopened.length, breached: breached.length,
      breach_rate_pct: own.length ? Math.round((breached.length / own.length) * 1000) / 10 : 0,
      avg_days_open: Math.round(avg(own.map((r) => Number(r.sla_days_open) || 0))),
      avg_days_to_close: closed.length
        ? Math.round(avg(closed.map((r) => Number(r.sla_days_open) || 0))) : null,
      unrealised_savings_inr: open.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0),
      realised_savings_inr:   closed.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0),
    };
  }).sort((a, b) => b.total - a.total);
};

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
        ? Math.round(avg(closed.map((t) => Number(t.sla_days_open) || 0))) : null,
    };
  }).sort((a, b) => b.total - a.total);
};

export const aggregate = async ({ group_by, metric = 'count', filters = {}, time_range } = {}) => {
  const valid = new Set(['module', 'function', 'priority', 'status', 'category', 'compliance_risk', 'assigned_to']);
  if (!valid.has(group_by)) throw new Error(`group_by must be one of: ${[...valid].join(', ')}`);

  const where = [];
  const binds = {};
  for (const [k, v] of Object.entries(filters || {})) {
    if (v !== undefined && v !== null && v !== '') {
      where.push(`${k} = :${k}`); binds[k] = v;
    }
  }
  if (time_range?.from) { where.push('submitted_at >= :tr_from'); binds.tr_from = time_range.from; }
  if (time_range?.to)   { where.push('submitted_at <= :tr_to');   binds.tr_to   = time_range.to; }
  const sql = `SELECT * FROM tickets${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const data = await query(sql, binds);

  const grouped = {};
  for (const r of data) {
    const k = r[group_by] ?? '(null)';
    if (!grouped[k]) grouped[k] = { group: k, count: 0, cost_savings: 0, days_open: [] };
    grouped[k].count++;
    grouped[k].cost_savings += Number(r.cost_savings) || 0;
    grouped[k].days_open.push(Number(r.sla_days_open) || 0);
  }
  return Object.values(grouped).map((g) => {
    const value = metric === 'sum_savings' ? g.cost_savings
      : metric === 'avg_days_open' ? Math.round(avg(g.days_open)) : g.count;
    return { group: g.group, value };
  }).sort((a, b) => b.value - a.value);
};

export const topTickets = async ({ metric = 'composite', n = 5, filters = {} } = {}) => {
  const where = [];
  const binds = { lim: MAX_ROWS };
  for (const [k, v] of Object.entries(filters || {})) {
    if (v !== undefined && v !== null && v !== '') { where.push(`${k} = :${k}`); binds[k] = v; }
  }
  const sql = `SELECT * FROM tickets${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
               FETCH FIRST :lim ROWS ONLY`;
  const rows = await query(sql, binds);
  const FREQ = { Daily: 100, Weekly: 75, Monthly: 40, Annual: 15, 'Ad-hoc': 15 };
  const sortKey = {
    cost_savings: (r) => Number(r.cost_savings) || 0,
    days_open:    (r) => Number(r.sla_days_open) || 0,
    people:       (r) => Number(r.people_affected) || 0,
    composite:    (r) => {
      const peopleN = Math.min(100, Number(r.people_affected) || 0);
      const hoursN  = Math.min(100, (Number(r.hours_lost_per_week) || 0) * 2);
      const costN   = Math.min(100, (Number(r.cost_savings) || 0) / 100000);
      return Math.round((peopleN + hoursN + costN + (FREQ[r.frequency] ?? 0)) / 4);
    },
  }[metric] || (() => 0);
  return rows.sort((a, b) => sortKey(b) - sortKey(a)).slice(0, Math.min(n, 10));
};

export const comparePeriods = async ({ metric = 'count', period_a, period_b, filters = {} } = {}) => {
  if (!period_a?.from || !period_a?.to || !period_b?.from || !period_b?.to)
    throw new Error('compare_periods needs period_a and period_b with from/to');
  const grab = async (range) => {
    const where = ['submitted_at >= :from', 'submitted_at <= :to'];
    const binds = { from: range.from, to: range.to };
    for (const [k, v] of Object.entries(filters || {})) {
      if (v !== undefined && v !== null && v !== '') { where.push(`${k} = :${k}`); binds[k] = v; }
    }
    return query(`SELECT * FROM tickets WHERE ${where.join(' AND ')}`, binds);
  };
  const [a, b] = await Promise.all([grab(period_a), grab(period_b)]);
  const compute = (rows) => {
    if (metric === 'sum_savings') return rows.reduce((s, r) => s + (Number(r.cost_savings) || 0), 0);
    if (metric === 'avg_days_open') return Math.round(avg(rows.map((r) => Number(r.sla_days_open) || 0)));
    return rows.length;
  };
  const va = compute(a); const vb = compute(b);
  return { period_a: { ...period_a, value: va, count: a.length }, period_b: { ...period_b, value: vb, count: b.length },
    change_pct: va === 0 ? null : Math.round(((vb - va) / Math.abs(va)) * 1000) / 10 };
};

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
  const forecast = [];
  for (const [module, months] of Object.entries(byModuleMonth)) {
    const series = Object.keys(months).sort().map((k) => months[k]);
    if (!series.length) continue;
    let s = series[0];
    for (let i = 1; i < series.length; i++) s = 0.4 * series[i] + 0.6 * s;
    forecast.push({ module, history: series, projected_next_period: Math.round(s * (weeks / 4)) });
  }
  return forecast.sort((a, b) => b.projected_next_period - a.projected_next_period);
};

export const insightsMetricBundle = async () => {
  const [modules, pocs, forecast] = await Promise.all([modulePerformance(), pocPerformance(), submissionForecast({ weeks: 4 })]);
  const tickets = await allTickets();
  const grand = {
    total_tickets:          tickets.length,
    open:                   tickets.filter((t) => t.status !== 'Closed').length,
    breached:               tickets.filter((t) => t.sla_state === 'breached').length,
    reopened:               tickets.filter((t) => t.status === 'Reopened').length,
    compliance_flagged:     tickets.filter((t) => t.compliance_risk === 'Yes').length,
    realised_savings_inr:   tickets.filter((t) => t.status === 'Closed').reduce((s, t) => s + (Number(t.cost_savings) || 0), 0),
    unrealised_savings_inr: tickets.filter((t) => t.status !== 'Closed').reduce((s, t) => s + (Number(t.cost_savings) || 0), 0),
  };
  return { grand, modules, pocs, forecast };
};
