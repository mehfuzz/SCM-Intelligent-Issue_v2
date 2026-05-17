// High-level notification dispatcher.
//
// Every time a user-facing action is taken (ticket created, status changed,
// SLA-change requested, comment posted, BRD edited, …), the relevant page
// calls notify.something(...) instead of constructing the payload by hand.
// This centralises:
//   1. who the recipients are (submitter / assignee / approver / COE admins),
//   2. how the title + message read,
//   3. the type tag used by the icon picker in NotificationCenter.
//
// In demo mode the dispatcher logs the event to the console and pushes a
// row into MOCK_NOTIFICATIONS so the UI still reflects it. In live mode it
// POSTs to /api/notifications for fan-out.

import { MOCK_NOTIFICATIONS, MOCK_USERS, ROLES } from '../data/mockData';
import { api } from './api';
import { isLiveApi } from './hydrate';

const localFanout = (recipients, type, title, message, ticketId) => {
  for (const uid of new Set(recipients.filter(Boolean))) {
    MOCK_NOTIFICATIONS.unshift({
      id:        `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id:   uid,
      type, title, message,
      ticketId,
      at:        new Date().toISOString(),
      read:      false,
    });
  }
};

const send = async ({ recipients, type, title, message, ticketId }) => {
  const uniq = Array.from(new Set((recipients || []).filter(Boolean)));
  if (!uniq.length) return;

  if (!isLiveApi()) {
    localFanout(uniq, type, title, message, ticketId);
    return;
  }
  try {
    await api.postNotification({ recipients: uniq, type, title, message, ticketId });
  } catch (e) {
    // Fall back to local fanout so the UI still updates even if the API fails.
    console.warn('[notify] live post failed; logged locally', e);
    localFanout(uniq, type, title, message, ticketId);
  }
};

const idsByRole = (role) =>
  MOCK_USERS.filter((u) => u.role === role).map((u) => u.id);

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------
export const notify = {
  /** A new ticket has been submitted — alert COE admins. */
  ticketSubmitted: (ticket) =>
    send({
      recipients: idsByRole(ROLES.COE_ADMIN),
      type: 'assignment',
      title: 'New ticket in queue',
      message: `${ticket.id} — ${ticket.title}`,
      ticketId: ticket.id,
    }),

  /** A POC has been assigned (or re-assigned) to a ticket. */
  assigned: (ticket, newAssigneeId, actorName) =>
    send({
      recipients: [newAssigneeId, ticket.submittedById],
      type: 'assignment',
      title: 'Ticket assigned',
      message: `${ticket.id} was assigned by ${actorName || 'COE'}.`,
      ticketId: ticket.id,
    }),

  /** Generic status change — keeps submitter + assignee in the loop. */
  statusChanged: (ticket, before, after, actorName) =>
    send({
      recipients: [ticket.submittedById, ticket.assignedToId],
      type: 'assignment',
      title: 'Ticket status updated',
      message: `${ticket.id}: ${before || '—'} → ${after} (by ${actorName || 'COE'})`,
      ticketId: ticket.id,
    }),

  /** Priority change (COE override). */
  priorityChanged: (ticket, before, after, actorName) =>
    send({
      recipients: [ticket.submittedById, ticket.assignedToId],
      type: 'sla_at_risk',
      title: 'Priority changed',
      message: `${ticket.id}: ${before || '—'} → ${after} (by ${actorName || 'COE'})`,
      ticketId: ticket.id,
    }),

  /** New comment on a ticket — alert submitter + assignee, exclude the author. */
  commentPosted: (ticket, authorId, authorName, snippet) =>
    send({
      recipients: [ticket.submittedById, ticket.assignedToId].filter((id) => id && id !== authorId),
      type: 'comment',
      title: `${authorName} commented on ${ticket.id}`,
      message: snippet?.length > 80 ? `${snippet.slice(0, 80)}…` : (snippet || ''),
      ticketId: ticket.id,
    }),

  /** Submitter / COE edited the description. */
  descriptionEdited: (ticket, actorName) =>
    send({
      recipients: [ticket.submittedById, ticket.assignedToId].filter((id) => id && id !== undefined),
      type: 'comment',
      title: 'Description updated',
      message: `${ticket.id} description was edited by ${actorName}.`,
      ticketId: ticket.id,
    }),

  /** POC asks for an SLA change — the chosen approver gets the notification. */
  slaChangeRequested: (ticket, approverId, requestedHours, justification) =>
    send({
      recipients: [approverId],
      type: 'sla_at_risk',
      title: 'SLA change request',
      message: `${ticket.id}: ${ticket.sla?.resolutionHours ?? '—'}h → ${requestedHours}h. ${justification}`,
      ticketId: ticket.id,
    }),

  /** Approver decides on the request — the POC who asked is notified. */
  slaChangeDecided: (ticket, decision, decidedBy) =>
    send({
      recipients: [ticket.slaChangeRequest?.requestedById, ticket.submittedById],
      type: decision === 'Approved' ? 'assignment' : 'sla_at_risk',
      title: `SLA change ${decision.toLowerCase()}`,
      message: `${ticket.id}: decision by ${decidedBy}.`,
      ticketId: ticket.id,
    }),

  /** A JIRA key was linked — submitter sees it for tracking. */
  jiraLinked: (ticket, jiraKey, actorName) =>
    send({
      recipients: [ticket.submittedById],
      type: 'assignment',
      title: 'JIRA linked',
      message: `${ticket.id} ↔ ${jiraKey} (by ${actorName}).`,
      ticketId: ticket.id,
    }),

  /** BRD action — POC asks submitter for edits, or vice versa. */
  brdEditRequested: (ticket, requestText, actorName) =>
    send({
      recipients: [ticket.submittedById],
      type: 'validation',
      title: `BRD edit requested by ${actorName}`,
      message: requestText?.length > 120 ? `${requestText.slice(0, 120)}…` : (requestText || ''),
      ticketId: ticket.id,
    }),

  /** BRD approved — submitter knows the BRD is locked in. */
  brdApproved: (ticket, actorName) =>
    send({
      recipients: [ticket.submittedById, ticket.assignedToId],
      type: 'validation',
      title: 'BRD approved',
      message: `BRD for ${ticket.id} approved by ${actorName}.`,
      ticketId: ticket.id,
    }),

  /** Generic test-evidence available — for the submitter to validate. */
  validationReady: (ticket) =>
    send({
      recipients: [ticket.submittedById],
      type: 'validation',
      title: 'Validation ready',
      message: `${ticket.id} is ready for your validation.`,
      ticketId: ticket.id,
    }),
};
