import type { HelpdeskStatus, HelpdeskTicket, Role, User } from "../../lib/types";

/** UI-only gating — the server is the real enforcement boundary (see backend workflow.ts). */

export function canAssign(role: Role): boolean {
  return role === "IT_TEAM_LEAD" || role === "ADMIN";
}

export function isMyHelpdeskTicket(ticket: HelpdeskTicket, user: User): boolean {
  if (user.role === "ADMIN" || user.role === "IT_TEAM_LEAD") return true;
  if (user.role === "IT_SUPPORT_ENGINEER") return ticket.assignedToId === user.id;
  return ticket.raisedById === user.id;
}

export function canStartProgress(ticket: HelpdeskTicket, user: User): boolean {
  if (ticket.status !== "ASSIGNED") return false;
  if (user.role === "IT_TEAM_LEAD" || user.role === "ADMIN") return true;
  return user.role === "IT_SUPPORT_ENGINEER" && ticket.assignedToId === user.id;
}

export function canHoldOrResume(ticket: HelpdeskTicket, user: User): boolean {
  if (ticket.status !== "ASSIGNED" && ticket.status !== "IN_PROGRESS") return false;
  if (user.role === "IT_TEAM_LEAD" || user.role === "ADMIN") return true;
  return user.role === "IT_SUPPORT_ENGINEER" && ticket.assignedToId === user.id;
}

export function canResolve(ticket: HelpdeskTicket, user: User): boolean {
  if (ticket.status !== "IN_PROGRESS") return false;
  if (user.role === "IT_TEAM_LEAD" || user.role === "ADMIN") return true;
  return user.role === "IT_SUPPORT_ENGINEER" && ticket.assignedToId === user.id;
}

export function canClose(ticket: HelpdeskTicket, user: User): boolean {
  return ticket.status === "RESOLVED" && (user.role === "IT_TEAM_LEAD" || user.role === "ADMIN");
}

export function canReopen(ticket: HelpdeskTicket, user: User): boolean {
  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") return false;
  return user.role === "IT_TEAM_LEAD" || user.role === "ADMIN" || ticket.raisedById === user.id;
}

export const STATUS_ORDER: HelpdeskStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"];
