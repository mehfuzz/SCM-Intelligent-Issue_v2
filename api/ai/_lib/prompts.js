// BRD generation prompt + JSON schema, shared by every provider adapter.
//
// The system prompt is intentionally explicit about style — short paragraphs,
// numbered FRs, ₹ for INR, no marketing language. The schema is the SAME
// six section keys the BrdEditor renders, so the frontend can drop the
// response straight into its textareas with zero post-processing.

export const BRD_SECTION_KEYS = [
  'Background',
  'Objective',
  'Scope',
  'Functional Requirements',
  'Acceptance Criteria',
  'Risks & Dependencies',
];

export const BRD_JSON_SCHEMA = {
  type: 'object',
  required: BRD_SECTION_KEYS,
  additionalProperties: false,
  properties: BRD_SECTION_KEYS.reduce((acc, k) => {
    acc[k] = { type: 'string', minLength: 20 };
    return acc;
  }, {}),
};

export const SYSTEM_PROMPT = `You are a senior Business Requirements Document (BRD) analyst for Airtel's SCM Center of Excellence.

You will be given the structured details of one SCM issue ticket. Your job is to draft a BRD that a POC owner can use as a starting point — they will edit it before finalising.

Output strictly as JSON matching this exact shape, with these six section keys:
  - "Background"
  - "Objective"
  - "Scope"
  - "Functional Requirements"
  - "Acceptance Criteria"
  - "Risks & Dependencies"

Style rules:
  * Background: 2–3 sentences. State the problem, who is affected, and the measurable impact (hours / week, ₹ saving potential, frequency).
  * Objective: a single sentence beginning with a verb. State the measurable target outcome.
  * Scope: short paragraph or bulleted lines. Name the SCM module(s) and sub-process(es) in scope. End with one explicit "Out of scope: …" line.
  * Functional Requirements: numbered list (1., 2., 3., …). Each requirement is a single atomic statement beginning with "System shall" or "The process shall". Aim for 4–7 items. Cover the happy path AND the audit/escalation/exception path.
  * Acceptance Criteria: bullet list with concrete, measurable thresholds (e.g. "PO/GRN mismatches blocked at invoice posting: 100%", "SLA breach alerts fire within 60 minutes of breach"). Aim for 3–5 bullets.
  * Risks & Dependencies: bulleted. For each risk or dependency, name the owning team or system (e.g. "Oracle EBS patch level", "AP team training", "AD group sync") and one mitigating action.

Hard constraints:
  * Use ₹ for INR amounts, not Rs. or INR.
  * Refer to modules / functions / sub-processes by the names provided in the input. Do not invent new ones.
  * No marketing language ("seamlessly", "leverage", "world-class"). Be precise and operational.
  * If the input is missing a field (e.g. no cost saving stated), say "not specified" — do not invent numbers.
  * Output ONLY the JSON object. No prose outside it, no markdown code fences.`;

// Build the user-side payload for the LLM. The structure is deliberately
// kept consistent across providers so prompt-cache hit rates stay stable.
export const userPromptFor = (ticket) => {
  const i = ticket?.impact || {};
  return [
    `Ticket ID: ${ticket.id}`,
    `Title: ${ticket.title}`,
    `Module: ${ticket.module || '—'}`,
    `Sub-Process: ${ticket.subProcess || ticket.sub_process || '—'}`,
    `Function: ${ticket.function || '—'}`,
    `Category: ${ticket.category || '—'}`,
    `Submitted by: ${ticket.submittedBy || ticket.submitted_by || '—'}`,
    `Frequency: ${i.frequency || ticket.frequency || '—'}`,
    `People affected: ${i.peopleAffected ?? ticket.people_affected ?? 'not specified'}`,
    `Hours lost per week: ${i.hoursLostPerWeek ?? ticket.hours_lost_per_week ?? 'not specified'}`,
    `Annual cost saving potential: ${
      (i.costSavings ?? ticket.cost_savings) != null
        ? `₹${i.costSavings ?? ticket.cost_savings}`
        : 'not specified'
    }`,
    `Compliance risk: ${i.complianceRisk || ticket.compliance_risk || 'No'}`,
    '',
    'Description (verbatim from submitter):',
    ticket.description || '(none provided)',
    '',
    'Suggested solution (verbatim from submitter):',
    ticket.suggestedSolution || ticket.suggested_solution || '(none provided)',
    '',
    'Draft the BRD now as the JSON object specified.',
  ].join('\n');
};
