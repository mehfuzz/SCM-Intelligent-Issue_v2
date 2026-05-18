// Map Oracle rows ↔ frontend ticket shape.
// oracle.js normalises all column names to lowercase, so r.function works as expected.

export const rowToTicket = (r) => ({
  id: r.id,
  title: r.title,
  module: r.module,
  subProcess: r.sub_process,
  function: r.function,
  category: r.category,
  description: r.description,
  submittedBy: r.submitted_by,
  submittedById: r.submitted_by_id,
  submittedAt: r.submitted_at,
  assignedTo: r.assigned_to,
  assignedToId: r.assigned_to_id,
  status: r.status,
  priority: r.priority,
  impact: {
    peopleAffected:   r.people_affected,
    frequency:        r.frequency,
    hoursLostPerWeek: r.hours_lost_per_week,
    costSavings:      r.cost_savings,
    complianceRisk:   r.compliance_risk,
  },
  sla: {
    responseHours:   r.sla_response_hours,
    resolutionHours: r.sla_resolution_hours,
    elapsed:         r.sla_elapsed_hours,
    state:           r.sla_state,
    daysOpen:        r.sla_days_open,
    target:          r.sla_state === 'breached' ? 'BREACH' : (r.sla_state === 'at-risk' ? 'At risk' : 'On Track'),
  },
  coeEffortDays: r.coe_effort_days,
  suggestedSolution: r.suggested_solution,
  supportingEvidence: r.supporting_evidence,
  notes: r.notes,
  relatedTicketId: r.related_ticket_id,
  parentId: r.parent_id,
  childrenIds: r.children_ids || [],
  brdId: r.brd_id,
  brdStatus: r.brd_status,
  tags: r.tags || [],
});

export const ticketToRow = (t) => ({
  id: t.id,
  title: t.title,
  module: t.module,
  sub_process: t.subProcess,
  function: t.function,
  category: t.category,
  description: t.description,
  submitted_by: t.submittedBy,
  submitted_by_id: t.submittedById,
  submitted_at: t.submittedAt,
  assigned_to: t.assignedTo,
  assigned_to_id: t.assignedToId,
  status: t.status,
  priority: t.priority,
  people_affected:     t.impact?.peopleAffected ?? 0,
  frequency:           t.impact?.frequency ?? 'Weekly',
  hours_lost_per_week: t.impact?.hoursLostPerWeek ?? 0,
  cost_savings:        t.impact?.costSavings ?? 0,
  compliance_risk:     t.impact?.complianceRisk ?? 'No',
  sla_response_hours:   t.sla?.responseHours ?? 24,
  sla_resolution_hours: t.sla?.resolutionHours ?? 168,
  sla_elapsed_hours:    t.sla?.elapsed ?? 0,
  sla_state:            t.sla?.state ?? 'on-track',
  sla_days_open:        t.sla?.daysOpen ?? 0,
  coe_effort_days:      t.coeEffortDays ?? 0,
  suggested_solution:   t.suggestedSolution ?? '',
  supporting_evidence:  t.supportingEvidence ?? '',
  notes:                t.notes ?? '',
  related_ticket_id:    t.relatedTicketId ?? null,
  parent_id:            t.parentId ?? null,
  brd_id:               t.brdId ?? null,
  brd_status:           t.brdStatus ?? null,
  tags:                 t.tags ?? [],
});

// Patches sent by PATCH /api/tickets/[id] — only translate keys that exist.
export const patchToRow = (patch) => {
  const out = {};
  const map = {
    title: 'title',
    module: 'module',
    subProcess: 'sub_process',
    function: 'function',
    category: 'category',
    description: 'description',
    status: 'status',
    priority: 'priority',
    assignedTo: 'assigned_to',
    assignedToId: 'assigned_to_id',
    coeEffortDays: 'coe_effort_days',
    suggestedSolution: 'suggested_solution',
    supportingEvidence: 'supporting_evidence',
    notes: 'notes',
  };
  for (const [k, v] of Object.entries(patch || {})) {
    if (k in map) out[map[k]] = v;
  }
  if (patch?.impact) {
    if ('peopleAffected'   in patch.impact) out.people_affected     = patch.impact.peopleAffected;
    if ('frequency'        in patch.impact) out.frequency           = patch.impact.frequency;
    if ('hoursLostPerWeek' in patch.impact) out.hours_lost_per_week = patch.impact.hoursLostPerWeek;
    if ('costSavings'      in patch.impact) out.cost_savings        = patch.impact.costSavings;
    if ('complianceRisk'   in patch.impact) out.compliance_risk     = patch.impact.complianceRisk;
  }
  if (patch?.sla) {
    if ('responseHours'   in patch.sla) out.sla_response_hours   = patch.sla.responseHours;
    if ('resolutionHours' in patch.sla) out.sla_resolution_hours = patch.sla.resolutionHours;
    if ('elapsed'         in patch.sla) out.sla_elapsed_hours    = patch.sla.elapsed;
    if ('state'           in patch.sla) out.sla_state            = patch.sla.state;
    if ('daysOpen'        in patch.sla) out.sla_days_open        = patch.sla.daysOpen;
  }
  return out;
};
