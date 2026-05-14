// Server-side mirror of the frontend prioritisation engine. Kept in sync with
// frontend/src/data/mockData.js — same percentile semantics, same composite.

const FREQ_BASE = { Daily: 100, Weekly: 75, Monthly: 40, 'Ad-hoc': 15 };

const percentRank = (values, v) => {
  if (!values.length) return 0;
  const n = values.length;
  if (n <= 1) return 0;
  let below = 0;
  for (const x of values) if (x < v) below++;
  return Math.round((below / (n - 1)) * 1000) / 10;
};

export const computeScoresAndTier = (ticket, all) => {
  const people = all.map((t) => Number(t.people_affected ?? t.impact?.peopleAffected) || 0);
  const hours  = all.map((t) => Number(t.hours_lost_per_week ?? t.impact?.hoursLostPerWeek) || 0);
  const cost   = all.map((t) => Number(t.cost_savings ?? t.impact?.costSavings) || 0);
  const freq   = all.map((t) => FREQ_BASE[t.frequency ?? t.impact?.frequency] ?? 0);

  const p = Number(ticket.people_affected ?? ticket.impact?.peopleAffected) || 0;
  const h = Number(ticket.hours_lost_per_week ?? ticket.impact?.hoursLostPerWeek) || 0;
  const c = Number(ticket.cost_savings ?? ticket.impact?.costSavings) || 0;
  const f = FREQ_BASE[ticket.frequency ?? ticket.impact?.frequency] ?? 0;

  const peopleScore = percentRank(people, p);
  const timeScore   = percentRank(hours,  h);
  const costScore   = percentRank(cost,   c);
  const freqScore   = percentRank(freq,   f);

  const composite = Math.round(((peopleScore + timeScore + costScore + freqScore) / 4) * 10) / 10;

  const compliance = ticket.compliance_risk ?? ticket.impact?.complianceRisk;
  let tier = 'P3';
  if (compliance === 'Yes') tier = 'P0';
  else if (composite >= 70) tier = 'P1';
  else if (composite >= 40) tier = 'P2';

  return { peopleScore, timeScore, costScore, freqScore, composite, tier };
};
