// Mock data for Airtel SCM Issue Intelligence & Workflow Management Portal
// Frontend-only — used to populate dashboards, tables, forms, charts.
// Data model mirrors the Framework "Issue Log" + "Prioritisation Parameters" sheets.

export const ROLES = {
  SUBMITTER: 'Submitter',
  COE_ADMIN: 'COE Admin',
  POC_OWNER: 'POC Owner',
  LEADERSHIP: 'Leadership',
  SYSTEM_ADMIN: 'System Admin',
};

export const MOCK_USERS = [
  { id: 'u1', name: 'Ravi Kumar',     email: 'ravi.kumar@airtel.in',   password: 'demo123', role: ROLES.SUBMITTER,   department: 'SCM Operations',           avatarInitials: 'RK' },
  { id: 'u2', name: 'Priya Sharma',   email: 'priya.sharma@airtel.in', password: 'demo123', role: ROLES.COE_ADMIN,   department: 'SCM Center of Excellence', avatarInitials: 'PS' },
  { id: 'u3', name: 'Amit Singh',     email: 'amit.singh@airtel.in',   password: 'demo123', role: ROLES.POC_OWNER,   department: 'Procurement Tech',         avatarInitials: 'AS' },
  { id: 'u4', name: 'Neeta Rao',      email: 'neeta.rao@airtel.in',    password: 'demo123', role: ROLES.LEADERSHIP,  department: 'SCM Leadership',           avatarInitials: 'NR' },
  { id: 'u5', name: 'System Admin',   email: 'admin@airtel.in',        password: 'demo123', role: ROLES.SYSTEM_ADMIN,department: 'IT Platform',              avatarInitials: 'SA' },
  { id: 'u6', name: 'Kushal Soni',    email: 'kushal.soni@airtel.in',  password: 'demo123', role: ROLES.POC_OWNER,   department: 'SCM CoE',                  avatarInitials: 'KS' },
  { id: 'u7', name: 'Shikha Aggarwal',email: 'shikha@airtel.in',       password: 'demo123', role: ROLES.POC_OWNER,   department: 'SCM CoE',                  avatarInitials: 'SA' },
  { id: 'u8', name: 'Rajesh Kansal',  email: 'rajesh.kansal@airtel.in',password: 'demo123', role: ROLES.SUBMITTER,   department: 'Infra Procurement',        avatarInitials: 'RK' },
  { id: 'u9', name: 'Akram Raza',     email: 'akram.raza@airtel.in',   password: 'demo123', role: ROLES.SUBMITTER,   department: 'Material Management',      avatarInitials: 'AR' },
];

// Aligned with user-supplied SCM module list
export const MODULES = [
  'NFA', 'SOW', 'Sourcing', 'GBPA', 'Contract',
  'PR', 'PO', 'Downstream', 'Vendor Onboarding', 'Master Data',
];

// Aligned with user-supplied function list
export const FUNCTIONS = [
  'Network', 'IT', 'Infra', 'COE', 'DTH', 'Nxtra', 'Service',
  'Material Management', 'ToCo', 'B2B', 'Real Estate', 'Bharti Foundation', 'Content',
];

// From user request — replaces the framework's 5-category taxonomy.
export const CATEGORIES = [
  'Process Gap',
  'Technical Bug',
  'Visibility Gap',
  'Automation Opportunity',
  'New Development',
  'Compliance & Risk',
  'Data Quality',
  'Dashboard & Reporting',
];

// Frequencies as required by the user: Daily, Weekly, Monthly, Annual.
// We also accept the legacy 'Ad-hoc' value (same weight as Annual) so existing
// DB rows from the earlier framework don't break the scoring formula.
export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Annual'];
export const STATUSES   = ['Submitted', 'Triaged', 'POC Assigned', 'In Progress', 'Pending Validation', 'Closed', 'Reopened'];
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

// Sub-stages a POC owner can pick once a ticket reaches "In Progress".
// System Admin can edit this list at runtime via Admin Console.
export const IN_PROGRESS_SUBSTAGES_DEFAULT = [
  'Requirements gathering',
  'Design',
  'Development',
  'Code review',
  'QA / Testing',
  'UAT',
  'Awaiting deployment',
];

// -----------------------------------------------------------------------------
// Priority calculation (mirrors Framework "Prioritisation Parameters" sheet)
// -----------------------------------------------------------------------------

// Frequency base scores per the framework.
// 'Annual' is the new canonical low-frequency value; 'Ad-hoc' is kept as an
// alias for legacy seed rows so they still score consistently.
export const FREQ_BASE = {
  Daily:    100,
  Weekly:   75,
  Monthly:  40,
  Annual:   15,
  'Ad-hoc': 15, // legacy alias — scored same as Annual
};

// Percentile rank on 0..100 scale (Excel PERCENTRANK semantics, INC)
const percentRank = (values, v) => {
  const arr = values.slice().sort((a, b) => a - b);
  const n = arr.length;
  if (n <= 1) return 0;
  // count strictly less than v
  let below = 0;
  for (const x of arr) if (x < v) below++;
  // proportion of values strictly below v
  return Math.round((below / (n - 1)) * 1000) / 10;
};

// Defensive impact accessor — handles tickets that arrive without an impact
// envelope (older rows, partial API payloads, etc.) without throwing.
const imp = (t) => t?.impact || {};

export const computeScores = (ticket, all) => {
  const peopleVals = all.map((t) => Number(imp(t).peopleAffected) || 0);
  const hoursVals  = all.map((t) => Number(imp(t).hoursLostPerWeek) || 0);
  const costVals   = all.map((t) => Number(imp(t).costSavings) || 0);
  const freqVals   = all.map((t) => FREQ_BASE[imp(t).frequency] ?? 0);

  const peopleScore = percentRank(peopleVals, Number(imp(ticket).peopleAffected) || 0);
  const timeScore   = percentRank(hoursVals,  Number(imp(ticket).hoursLostPerWeek) || 0);
  const costScore   = percentRank(costVals,   Number(imp(ticket).costSavings) || 0);
  const freqScore   = percentRank(freqVals,   FREQ_BASE[imp(ticket).frequency] ?? 0);

  const composite = Math.round(((peopleScore + timeScore + costScore + freqScore) / 4) * 10) / 10;
  return { peopleScore, timeScore, costScore, freqScore, composite };
};

// Case-insensitive compliance check so 'Yes' / 'yes' / 'YES' / 'true' all
// trigger the Priority Zero override.
export const isComplianceYes = (v) =>
  v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'yes');

export const computeTier = (composite, complianceRisk) => {
  if (isComplianceYes(complianceRisk)) return 'P0';
  if (composite >= 70) return 'P1';
  if (composite >= 40) return 'P2';
  return 'P3';
};

// Comparator used wherever we need "P0 first, then by composite desc".
// Lower priority code (P0 < P1 < P2 < P3) wins; ties broken by higher
// composite score.
export const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
export const byPriorityThenComposite = (a, b) => {
  const dp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  if (dp !== 0) return dp;
  return (b.composite || 0) - (a.composite || 0);
};

export const tierLabel = (tier) => {
  switch (tier) {
    case 'P0': return 'P0 (Compliance)';
    case 'P1': return 'P1 (Critical)';
    case 'P2': return 'P2 (High)';
    case 'P3': return 'P3 (Standard)';
    default:   return tier;
  }
};

// Linear ranking. P0 (compliance overrides) come first — within P0 we sort
// by composite DESC (high-impact compliance risks rank first; this differs
// from the original Excel demo but is the prioritisation behaviour the user
// asked for: "P0 first and then based on priority scores"). Non-P0 tickets
// then sort by composite descending.
export const linearRank = (tickets) => {
  const withScores = tickets.map((t) => {
    const scores = computeScores(t, tickets);
    const tier = computeTier(scores.composite, imp(t).complianceRisk);
    return { ...t, scores, tier };
  });
  const p0   = withScores.filter((t) => t.tier === 'P0').sort((a, b) => b.scores.composite - a.scores.composite);
  const rest = withScores.filter((t) => t.tier !== 'P0').sort((a, b) => b.scores.composite - a.scores.composite);
  return [...p0, ...rest].map((t, i) => ({ ...t, rank: i + 1 }));
};

// -----------------------------------------------------------------------------
// Tickets — modelled on Framework "Issue Log" sample rows
// -----------------------------------------------------------------------------

export const MOCK_TICKETS = [
  {
    id: 'SCM-SOW-001',
    title: 'Manual / Avoidable Step',
    module: 'SOW', subProcess: 'SOW Review & Approval',
    function: 'Material Management',
    category: 'Process Issues',
    description: 'Manual SOW validation causes 3–5 day delays before vendor onboarding can begin.',
    submittedBy: 'Akram Raza', submittedById: 'u9',
    submittedAt: '2026-04-10T09:00:00Z',
    assignedTo: 'Kushal Soni', assignedToId: 'u6',
    status: 'In Progress',
    impact: { peopleAffected: 4, frequency: 'Daily', hoursLostPerWeek: 18, costSavings: 150000, complianceRisk: 'No' },
    sla: { responseHours: 8, resolutionHours: 72, elapsed: 96, state: 'breached', target: 'BREACH', daysOpen: 33 },
    coeEffortDays: 12,
    suggestedSolution: 'Auto-route SOW to predefined validator pool with rule-based pre-checks.',
    supportingEvidence: 'https://airtel.sharepoint.com/scm/sow-delay-evidence.pdf',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['sow', 'manual'],
  },
  {
    id: 'SCM-VND-002',
    title: 'Handoff Failure',
    module: 'Vendor Onboarding', subProcess: 'Vendor Verification',
    function: 'Infra',
    category: 'Process Issues',
    description: 'Vendor verification done via email chains with no tracking or acknowledgement.',
    submittedBy: 'Rajesh Kansal', submittedById: 'u8',
    submittedAt: '2026-04-12T09:00:00Z',
    assignedTo: 'Shikha Aggarwal', assignedToId: 'u7',
    status: 'Triaged',
    impact: { peopleAffected: 3, frequency: 'Daily', hoursLostPerWeek: 22, costSavings: 50000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 92, state: 'on-track', target: 'On Track', daysOpen: 31 },
    coeEffortDays: 8,
    suggestedSolution: 'Move verification to portal with status tracking and acknowledgements.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['vendor', 'handoff'],
  },
  {
    id: 'SCM-GBP-003',
    title: 'Approval Bottleneck',
    module: 'GBPA', subProcess: 'Approval Workflow',
    function: 'Network',
    category: 'Process Issues',
    description: 'Single approver for all GBPA requests above threshold; 3–7 day queue building up.',
    submittedBy: 'Varun Mehta', submittedById: 'u8',
    submittedAt: '2026-04-14T09:00:00Z',
    assignedTo: 'Rajesh Kansal', assignedToId: 'u8',
    status: 'POC Assigned',
    impact: { peopleAffected: 3.5, frequency: 'Daily', hoursLostPerWeek: 15, costSavings: 25000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 80, state: 'on-track', target: 'On Track', daysOpen: 29 },
    coeEffortDays: 5,
    suggestedSolution: 'Tier-based approval matrix with parallel routing.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['gbpa', 'approval'],
  },
  {
    id: 'SCM-PO-004',
    title: 'Financial Leakage — PO/GRN Mismatch',
    module: 'PO', subProcess: 'GRN Matching',
    function: 'ToCo',
    category: 'Compliance & Risk',
    description: 'PO-GRN mismatch resulting in potential duplicate payments — 4 confirmed cases in Q1.',
    submittedBy: 'Shikha Aggarwal', submittedById: 'u7',
    submittedAt: '2026-04-15T09:00:00Z',
    assignedTo: 'Varun Mehta', assignedToId: 'u3',
    status: 'In Progress',
    impact: { peopleAffected: 6, frequency: 'Weekly', hoursLostPerWeek: 8, costSavings: 80000, complianceRisk: 'Yes' },
    sla: { responseHours: 4, resolutionHours: 48, elapsed: 60, state: 'on-track', target: 'On Track', daysOpen: 28 },
    coeEffortDays: 10,
    suggestedSolution: 'Enforce 3-way match in ERP and block duplicate payment runs.',
    supportingEvidence: 'audit-finding-Q1.xlsx',
    testEvidence: [],
    notes: 'Auto P0 — compliance override',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Approved', brdId: 'BRD-004',
    tags: ['po', 'grn', 'compliance'],
  },
  {
    id: 'SCM-NFA-005',
    title: 'Unclear Process Design — NFA Turnaround',
    module: 'NFA', subProcess: 'NFA Submission',
    function: 'DTH',
    category: 'Process Issues',
    description: 'NFA turnaround exceeds 7 days; no SLA defined; different verticals using different steps.',
    submittedBy: 'Akram Raza', submittedById: 'u9',
    submittedAt: '2026-04-16T09:00:00Z',
    assignedTo: null, assignedToId: null,
    status: 'Submitted',
    impact: { peopleAffected: 2.5, frequency: 'Weekly', hoursLostPerWeek: 12, costSavings: 300000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 32, state: 'on-track', target: 'On Track', daysOpen: 27 },
    coeEffortDays: 6,
    suggestedSolution: 'Standardised NFA template + SLA-driven workflow.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['nfa', 'sla'],
  },
  {
    id: 'SCM-ORC-006',
    title: 'Oracle MOAC Report Bug',
    module: 'PO', subProcess: 'MOAC Report',
    function: 'Material Management',
    category: 'System & Tool Issues',
    description: 'MOAC Oracle report not auto-refreshing for cost centre 4502; manual refresh takes 45 min/day.',
    submittedBy: 'Gaurav Khanna', submittedById: 'u9',
    submittedAt: '2026-04-18T09:00:00Z',
    assignedTo: 'Gaurav Khanna', assignedToId: 'u3',
    status: 'In Progress',
    impact: { peopleAffected: 0.75, frequency: 'Daily', hoursLostPerWeek: 6, costSavings: 30000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 120, elapsed: 60, state: 'on-track', target: 'On Track', daysOpen: 25 },
    coeEffortDays: 3,
    suggestedSolution: 'Add scheduled refresh job for impacted cost centres.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'In Review', brdId: 'BRD-006',
    tags: ['oracle', 'report'],
  },
  {
    id: 'SCM-CON-007',
    title: 'Inaccurate Contract Values in i360',
    module: 'Contract', subProcess: 'Contract Amendment',
    function: 'Infra',
    category: 'Data & Reporting',
    description: 'i360 showing pre-amendment contract values; 8 contracts affected; causing reconciliation errors.',
    submittedBy: 'Rajesh Kansal', submittedById: 'u8',
    submittedAt: '2026-04-20T09:00:00Z',
    assignedTo: 'Shikha Aggarwal', assignedToId: 'u7',
    status: 'Triaged',
    impact: { peopleAffected: 2, frequency: 'Weekly', hoursLostPerWeek: 10, costSavings: 10000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 45, state: 'on-track', target: 'On Track', daysOpen: 23 },
    coeEffortDays: 4,
    suggestedSolution: 'Bi-directional sync between contract repo and i360.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['contract', 'reporting'],
  },
  {
    id: 'SCM-SRC-008',
    title: 'Knowledge Gap — Vendor Shortlisting',
    module: 'Sourcing', subProcess: 'Vendor Shortlisting',
    function: 'Network',
    category: 'People & Knowledge',
    description: 'No documented process for vendor shortlisting criteria; different buyers applying different rules.',
    submittedBy: 'Akram Raza', submittedById: 'u9',
    submittedAt: '2026-04-22T09:00:00Z',
    assignedTo: null, assignedToId: null,
    status: 'Submitted',
    impact: { peopleAffected: 1.5, frequency: 'Weekly', hoursLostPerWeek: 8, costSavings: 75000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 30, state: 'on-track', target: 'On Track', daysOpen: 21 },
    coeEffortDays: 5,
    suggestedSolution: 'Document & circulate a shortlisting scorecard; quarterly refresh.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['sourcing', 'sop'],
  },
  {
    id: 'SCM-PR-009',
    title: 'Oracle ↔ i360 PR Sync Gap',
    module: 'PR', subProcess: 'PR Approval',
    function: 'Material Management',
    category: 'System & Tool Issues',
    description: 'Oracle PR approvals not syncing to i360 dashboard; manual update required every morning.',
    submittedBy: 'Varun Mehta', submittedById: 'u3',
    submittedAt: '2026-04-24T09:00:00Z',
    assignedTo: 'Rajesh Kansal', assignedToId: 'u8',
    status: 'POC Assigned',
    impact: { peopleAffected: 1, frequency: 'Daily', hoursLostPerWeek: 14, costSavings: 120000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 120, elapsed: 50, state: 'on-track', target: 'On Track', daysOpen: 19 },
    coeEffortDays: 7,
    suggestedSolution: 'Event-driven push from Oracle to i360 on approval.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Pending', brdId: null,
    tags: ['oracle', 'i360'],
  },
  {
    id: 'SCM-SLA-010',
    title: 'Contractual SLA Breach — Vendor',
    module: 'Contract', subProcess: 'Vendor SLA Tracking',
    function: 'Network',
    category: 'Compliance & Risk',
    description: 'Vendor SLA breached on 3 active contracts; penalty clauses live; not flagged anywhere in system.',
    submittedBy: 'Shikha Aggarwal', submittedById: 'u7',
    submittedAt: '2026-04-26T09:00:00Z',
    assignedTo: 'Kushal Soni', assignedToId: 'u6',
    status: 'In Progress',
    impact: { peopleAffected: 2, frequency: 'Daily', hoursLostPerWeek: 5, costSavings: 200000, complianceRisk: 'Yes' },
    sla: { responseHours: 4, resolutionHours: 48, elapsed: 28, state: 'on-track', target: 'On Track', daysOpen: 17 },
    coeEffortDays: 6,
    suggestedSolution: 'SLA monitor with proactive alerts & penalty accrual ledger.',
    supportingEvidence: '',
    testEvidence: [],
    notes: 'Auto P0 — penalty accruing',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'In Review', brdId: 'BRD-010',
    tags: ['sla', 'compliance'],
  },
  // A closed item for "Reports" demonstration (Submitter view)
  {
    id: 'SCM-VND-011',
    title: 'Vendor Master Cleanup',
    module: 'Master Data', subProcess: 'Vendor Records',
    function: 'COE',
    category: 'Data & Reporting',
    description: 'Cleansed 1,200 duplicate vendor records; introduced dedup rules.',
    submittedBy: 'Ravi Kumar', submittedById: 'u1',
    submittedAt: '2026-03-02T09:00:00Z',
    assignedTo: 'Amit Singh', assignedToId: 'u3',
    status: 'Pending Validation',
    impact: { peopleAffected: 2, frequency: 'Weekly', hoursLostPerWeek: 4, costSavings: 240000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 168, elapsed: 120, state: 'on-track', target: 'On Track', daysOpen: 14 },
    coeEffortDays: 3,
    suggestedSolution: 'Dedup logic now live; ready for submitter validation.',
    supportingEvidence: '',
    testEvidence: [
      { id: 'te1', label: 'Dedup before/after screenshot', url: 'https://airtel.sharepoint.com/scm/dedup-screenshot.png' },
      { id: 'te2', label: 'UAT environment link',         url: 'https://uat.scm.airtel.in/vendor-master' },
    ],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Approved', brdId: 'BRD-011',
    tags: ['vendor', 'master-data'],
  },
  {
    id: 'SCM-PO-012',
    title: 'ASN Auto-Notification',
    module: 'Downstream', subProcess: 'ASN Tracking',
    function: 'Service',
    category: 'System & Tool Issues',
    description: 'ASN delay alerts now auto-fire after 24h slip.',
    submittedBy: 'Ravi Kumar', submittedById: 'u1',
    submittedAt: '2026-02-10T11:20:00Z',
    assignedTo: 'Amit Singh', assignedToId: 'u3',
    status: 'Closed',
    impact: { peopleAffected: 1, frequency: 'Weekly', hoursLostPerWeek: 6, costSavings: 240000, complianceRisk: 'No' },
    sla: { responseHours: 24, resolutionHours: 120, elapsed: 96, state: 'on-track', target: 'On Track', daysOpen: 6 },
    coeEffortDays: 3,
    suggestedSolution: 'Scheduled job scans ASN table and posts Teams alerts.',
    supportingEvidence: '',
    testEvidence: [],
    notes: '',
    relatedTicketId: '', parentId: null, childrenIds: [],
    brdStatus: 'Approved', brdId: 'BRD-012',
    tags: ['asn', 'notification'],
  },
];

// Decorate each ticket with priority tier, composite score, ranking — derived
// from the framework's Prioritisation Parameters so all consumers stay in sync.
(() => {
  const ranked = linearRank(MOCK_TICKETS);
  MOCK_TICKETS.forEach((t) => {
    const r = ranked.find((x) => x.id === t.id);
    if (!r) return;
    t.priority = r.tier;
    t.scores = r.scores;
    t.composite = r.scores.composite;
    t.rank = r.rank;
  });
})();

// -----------------------------------------------------------------------------
// Comments / Audit / Notifications / BRDs
// -----------------------------------------------------------------------------

export const MOCK_COMMENTS = {
  'SCM-SOW-001': [
    { id: 'c1', author: 'Priya Sharma', authorRole: 'COE Admin', text: 'Confirmed SLA breach; escalating to POC Owner.', at: '2026-04-12T11:30:00Z' },
    { id: 'c2', author: 'Kushal Soni',  authorRole: 'POC Owner', text: 'Drafted workflow change. Will share BRD by EOD.', at: '2026-04-15T17:45:00Z' },
  ],
  'SCM-PO-004': [
    { id: 'c4', author: 'Priya Sharma', authorRole: 'COE Admin', text: 'P0 by compliance override — duplicate payment risk.', at: '2026-04-16T09:00:00Z' },
  ],
};

export const MOCK_AUDIT = {
  'SCM-SOW-001': [
    { id: 'a1', at: '2026-04-10T09:00:00Z', actor: 'Akram Raza',  action: 'Issue submitted', detail: 'Created ticket via capture form' },
    { id: 'a2', at: '2026-04-10T09:01:00Z', actor: 'System',      action: 'Auto-prioritisation', detail: 'Composite 77.2 → P1' },
    { id: 'a3', at: '2026-04-11T10:15:00Z', actor: 'Priya Sharma',action: 'Status change',  detail: 'Submitted → Triaged' },
    { id: 'a4', at: '2026-04-12T11:32:00Z', actor: 'Priya Sharma',action: 'Assigned POC',   detail: 'Assigned to Kushal Soni' },
    { id: 'a5', at: '2026-04-12T11:35:00Z', actor: 'System',      action: 'Status change',  detail: 'Triaged → POC Assigned' },
    { id: 'a6', at: '2026-04-13T09:00:00Z', actor: 'Kushal Soni', action: 'Status change',  detail: 'POC Assigned → In Progress' },
  ],
  'SCM-PO-004': [
    { id: 'b1', at: '2026-04-15T09:00:00Z', actor: 'Shikha Aggarwal', action: 'Issue submitted', detail: 'Compliance flagged' },
    { id: 'b2', at: '2026-04-15T09:01:00Z', actor: 'System',          action: 'Priority Zero Override', detail: 'Compliance = Yes → P0' },
  ],
};

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'sla_breach',  title: 'SLA Breached',     message: 'SCM-SOW-001 has breached resolution SLA', ticketId: 'SCM-SOW-001', at: '2026-04-13T09:00:00Z', read: false },
  { id: 'n2', type: 'assignment',  title: 'New Assignment',   message: 'SCM-PR-009 has been assigned to you',      ticketId: 'SCM-PR-009',  at: '2026-04-24T09:35:00Z', read: false },
  { id: 'n3', type: 'comment',     title: 'New Comment',      message: 'Kushal Soni commented on SCM-SOW-001',     ticketId: 'SCM-SOW-001', at: '2026-04-15T17:45:00Z', read: true  },
  { id: 'n4', type: 'validation',  title: 'Validation Needed',message: 'SCM-VND-011 is ready for your validation', ticketId: 'SCM-VND-011', at: '2026-04-25T14:00:00Z', read: false },
  { id: 'n5', type: 'sla_at_risk', title: 'SLA At Risk',      message: 'SCM-VND-002 is approaching resolution SLA', ticketId: 'SCM-VND-002', at: '2026-04-26T08:00:00Z', read: false },
];

export const MOCK_BRDS = {
  'BRD-004': {
    id: 'BRD-004', ticketId: 'SCM-PO-004',
    title: 'BRD — PO/GRN 3-way Match Enforcement',
    status: 'Approved', version: 'v1.1',
    versions: [
      { v: 'v1.0', at: '2026-04-16T09:00:00Z', by: 'AI Draft' },
      { v: 'v1.1', at: '2026-04-17T11:20:00Z', by: 'Varun Mehta' },
    ],
    sections: {
      'Background':           'Four confirmed duplicate-payment cases traced to PO/GRN mismatches in Q1.',
      'Objective':            'Eliminate duplicate payments via enforced 3-way match in ERP.',
      'Scope':                'PO module — Invoice matching only.',
      'Functional Requirements': '1. Block invoice payment if PO/GRN/Invoice qty/value mismatch.\n2. Daily exception report to AP.\n3. Audit log for every override.',
      'Acceptance Criteria':  '• Zero duplicate payments in 30-day window.\n• 100% exception coverage in daily report.',
      'Risks & Dependencies': 'Oracle EBS patch level; finance team training.',
    },
  },
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export const formatINR = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const relativeTime = (iso) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Convert tickets array to CSV string matching the Excel "Issue Log" columns.
export const ticketsToCSV = (tickets) => {
  const ranked = linearRank(tickets);
  const headers = [
    'Rank', 'Issue ID', 'Date Submitted', 'Module', 'Sub-Process', 'Category',
    'Issue Title', 'Issue Description', 'Reported By', 'Function',
    'Frequency', 'People Affected', 'Time Lost (hrs/wk)', 'Estimated Cost Saving',
    'Compliance Risk?', 'People Score', 'Freq Score', 'Time Score', 'Cost Score',
    'Composite Score', 'Priority Tier', 'Stage', 'POC Owner', 'Days Open',
    'SLA Status', 'COE Effort (days)', 'Supporting Evidence', 'Notes',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = ranked.map((t) => [
    t.rank, t.id, formatDate(t.submittedAt), t.module, t.subProcess, t.category,
    t.title, t.description, t.submittedBy, t.function,
    t.impact.frequency, t.impact.peopleAffected, t.impact.hoursLostPerWeek, t.impact.costSavings,
    t.impact.complianceRisk, t.scores.peopleScore, t.scores.freqScore, t.scores.timeScore, t.scores.costScore,
    t.scores.composite, tierLabel(t.tier), t.status, t.assignedTo || '—', t.sla?.daysOpen ?? '',
    t.sla?.target ?? '', t.coeEffortDays, t.supportingEvidence || '', t.notes || '',
  ]);
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
};

export const downloadCSV = (filename, csv) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
