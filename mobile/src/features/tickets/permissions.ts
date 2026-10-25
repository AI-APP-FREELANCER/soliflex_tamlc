// UI-only gating, ported from backend/src/modules/tickets/workflow.ts. Server
// is the real enforcement boundary.
import type { Role, Ticket, TicketCategory, User, Workstream } from "@/lib/types";

/**
 * Which workstream a board user works in. Maintenance and IT are separate
 * workflows, so each user only sees their own. null = may see both.
 * (Mirrors backend/src/lib/workstream-scope.ts.)
 */
export function workstreamScopeFor(role: Role | undefined, workstream?: Workstream | null): Workstream | null {
  switch (role) {
    case "MECHANIC":
    case "PRODUCTION":
      return "MAINTENANCE";
    case "IT_TEAM":
      return "IT";
    case "MANAGER":
      return workstream ?? null;
    default:
      return null;
  }
}

function isManager(role: Role | undefined): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

function isMechanic(role: Role | undefined): boolean {
  return role === "MECHANIC";
}

function isProduction(role: Role | undefined): boolean {
  return role === "PRODUCTION" || isManager(role);
}

function isAssignee(ticket: Ticket, user: User | null): boolean {
  return !!user && ticket.assignedToId === user.id;
}

export function allowedWorkstreamsForCreate(role: Role | undefined, workstream?: Workstream | null): Workstream[] {
  if (isManager(role)) {
    const scope = workstreamScopeFor(role, workstream);
    return scope ? [scope] : ["MAINTENANCE", "IT"];
  }
  if (role === "PRODUCTION") return ["MAINTENANCE"];
  if (role === "IT_TEAM") return ["IT"];
  return [];
}

const MAINTENANCE_CATEGORIES: TicketCategory[] = ["PRODUCTION_MACHINE", "FACTORY_FACILITY", "OTHER_MACHINE"];
const IT_CATEGORIES: TicketCategory[] = ["WORKSTATION", "LAPTOP", "NETWORK_GEAR", "SERVER", "SOFTWARE"];

export function allowedCategoriesForCreate(role: Role | undefined, workstream: Workstream): TicketCategory[] {
  if (isManager(role)) return workstream === "MAINTENANCE" ? MAINTENANCE_CATEGORIES : IT_CATEGORIES;
  if (role === "PRODUCTION" && workstream === "MAINTENANCE") return ["PRODUCTION_MACHINE"];
  if (role === "IT_TEAM" && workstream === "IT") return IT_CATEGORIES;
  return [];
}

// --------------------------------------------------------------- IT only ---

export function canAssign(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status === "OPEN";
}

export function canEditAssignment(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status !== "OPEN" && ticket.status !== "CLOSED";
}

export function canStartProgress(ticket: Ticket, user: User | null): boolean {
  return isAssignee(ticket, user) && (ticket.status === "ASSIGNED" || ticket.status === "ACKNOWLEDGED");
}

export function canDirectClose(ticket: Ticket, user: User | null): boolean {
  return ticket.status === "IN_PROGRESS" && !ticket.onHold && ticket.workstream === "IT" && (isManager(user?.role) || isAssignee(ticket, user));
}

export function canReopen(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.workstream === "IT" && ticket.status === "CLOSED";
}

export function canHold(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "IT" && (isManager(user?.role) || isAssignee(ticket, user)) && ticket.status !== "CLOSED" && !ticket.onHold;
}

export function canResume(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "IT" && (isManager(user?.role) || isAssignee(ticket, user)) && ticket.onHold;
}

// --------------------------------------------------------- Maintenance only ---

export function canAcknowledge(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "MAINTENANCE" && ticket.status === "OPEN" && (isMechanic(user?.role) || isManager(user?.role));
}

export function canMaintHold(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "MAINTENANCE" && ticket.status === "IN_PROGRESS" && (isManager(user?.role) || isAssignee(ticket, user));
}

export function canMaintResume(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "MAINTENANCE" && ticket.status === "ON_HOLD" && (isManager(user?.role) || isAssignee(ticket, user));
}

export function canMarkVerificationNeeded(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "MAINTENANCE" && ticket.status === "IN_PROGRESS" && (isManager(user?.role) || isAssignee(ticket, user));
}

export function canVerifyOrReject(ticket: Ticket, user: User | null): boolean {
  return ticket.workstream === "MAINTENANCE" && ticket.status === "VERIFICATION_NEEDED" && isProduction(user?.role);
}

export const STATUS_ORDER: Ticket["status"][] = [
  "OPEN",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "ON_HOLD",
  "VERIFICATION_NEEDED",
  "VERIFIED",
  "REJECTED",
  "FIRST_LINE_REVIEW",
  "JOB_COMPLETED",
  "FINAL_REVIEW",
  "CLOSED",
];
