// Centralised access-control helpers.
//
// Two layers of enforcement:
//   1. Route-level role guard (RoleGuard component) — keeps users off
//      routes their role isn't authorised for, even if they type the URL.
//   2. Per-ticket scope check (canViewTicket) — used inside detail pages
//      to block direct-link access to tickets a user isn't part of.
//
// Visibility rules (user's directive):
//   Submitter   → only tickets where submittedById matches them
//   POC Owner   → only tickets where assignedToId matches them
//   COE Admin   → all tickets
//   Leadership  → all tickets (read-only enforced separately)
//   System Admin → all (support / platform)

import { ROLES } from '../data/mockData';

const PRIVILEGED = new Set([ROLES.COE_ADMIN, ROLES.LEADERSHIP, ROLES.SYSTEM_ADMIN]);

export const canViewTicket = (user, ticket) => {
  if (!user || !ticket) return false;
  if (PRIVILEGED.has(user.role)) return true;
  if (user.role === ROLES.SUBMITTER) return ticket.submittedById === user.id;
  if (user.role === ROLES.POC_OWNER) return ticket.assignedToId === user.id;
  return false;
};

// A BRD is reachable by the same people who can see its underlying ticket.
export const canViewBrd = (user, ticketForBrd) => canViewTicket(user, ticketForBrd);
