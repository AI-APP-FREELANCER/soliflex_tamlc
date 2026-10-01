// UI-only gating, ported verbatim from frontend/src/features/helpdesk/permissions.ts
// and backend/src/modules/helpdesk/workflow.ts — the server is the real
// enforcement boundary; this just drives what the mobile UI offers.
import type { HelpdeskTicket, Role, User } from "@/lib/types";

const LEAD_ROLES: Role[] = ["IT_TEAM_LEAD", "ADMIN"];

function isLead(role: Role | undefined): boolean {
  return !!role && LEAD_ROLES.includes(role);
}

function isAssigneeOrLead(ticket: HelpdeskTicket, user: User | null): boolean {
  if (!user) return false;
  if (isLead(user.role)) return true;
  return ticket.assignedToId === user.id;
}

export function canAssign(role: Role | undefined): boolean {
  return isLead(role);
}

export function canAssignTicket(ticket: HelpdeskTicket, user: User | null): boolean {
  return canAssign(user?.role) && ["OPEN", "ASSIGNED", "REOPENED"].includes(ticket.status);
}

export function canStartProgress(ticket: HelpdeskTicket, user: User | null): boolean {
  return ticket.status === "ASSIGNED" && isAssigneeOrLead(ticket, user);
}

export function canHoldOrResume(ticket: HelpdeskTicket, user: User | null): boolean {
  return ["ASSIGNED", "IN_PROGRESS"].includes(ticket.status) && isAssigneeOrLead(ticket, user);
}

export function canResolve(ticket: HelpdeskTicket, user: User | null): boolean {
  return ticket.status === "IN_PROGRESS" && isAssigneeOrLead(ticket, user);
}

export function canClose(ticket: HelpdeskTicket, user: User | null): boolean {
  return ticket.status === "RESOLVED" && isLead(user?.role);
}

export function canReopen(ticket: HelpdeskTicket, user: User | null): boolean {
  if (!["RESOLVED", "CLOSED"].includes(ticket.status)) return false;
  if (!user) return false;
  return isLead(user.role) || ticket.raisedById === user.id;
}

export const STATUS_ORDER: HelpdeskTicket["status"][] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];
