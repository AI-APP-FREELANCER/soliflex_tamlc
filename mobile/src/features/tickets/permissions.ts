// UI-only gating, ported from frontend/src/features/tickets/TicketDetailPage.tsx's
// inline role checks and backend/src/modules/tickets/workflow.ts. Server is the
// real enforcement boundary.
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

export function canAssign(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status === "OPEN";
}

export function canEditAssignment(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status !== "OPEN" && ticket.status !== "CLOSED";
}

export function canStartProgress(ticket: Ticket, user: User | null): boolean {
  return isAssignee(ticket, user) && ticket.status === "ASSIGNED";
}

// IT has no diagnosis/approval step: the engineer resolves and closes.
export function canSubmitRecommendation(ticket: Ticket, user: User | null): boolean {
  return isAssignee(ticket, user) && ticket.workstream === "MAINTENANCE" && ticket.status === "IN_PROGRESS" && !ticket.onHold;
}

/**
 * Fast close by the engineer or a manager, skipping the review chain: always for IT;
 * for Maintenance once the diagnosis shows no approval is needed (minor adjustment,
 * or a spare part below the cost threshold).
 */
export function canDirectClose(ticket: Ticket, user: User | null): boolean {
  if (ticket.status !== "IN_PROGRESS" || ticket.onHold) return false;
  if (!(isManager(user?.role) || isAssignee(ticket, user))) return false;
  return ticket.workstream === "IT" || (ticket.fixType !== null && !ticket.approvalRequired);
}

export function canDecideRecommendation(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status === "IN_PROGRESS" && ticket.onHold && ticket.onHoldReason === "APPROVAL";
}

export function canMarkFirstLineReview(ticket: Ticket, user: User | null): boolean {
  const reviewReady = ticket.fixType !== null && (!ticket.approvalRequired || !!ticket.approvedAt);
  return isAssignee(ticket, user) && ticket.workstream === "MAINTENANCE" && ticket.status === "IN_PROGRESS" && !ticket.onHold && reviewReady;
}

export function canMarkJobCompleted(ticket: Ticket, user: User | null): boolean {
  return (isManager(user?.role) || isAssignee(ticket, user)) && ticket.status === "FIRST_LINE_REVIEW";
}

export function canMarkFinalReview(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status === "JOB_COMPLETED";
}

export function canClose(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ticket.status === "FINAL_REVIEW";
}

export function canReopen(ticket: Ticket, user: User | null): boolean {
  return isManager(user?.role) && ["FIRST_LINE_REVIEW", "JOB_COMPLETED", "FINAL_REVIEW", "CLOSED"].includes(ticket.status);
}

export function canHold(ticket: Ticket, user: User | null): boolean {
  return (isManager(user?.role) || isAssignee(ticket, user)) && ticket.status !== "CLOSED" && !ticket.onHold;
}

export function canResume(ticket: Ticket, user: User | null): boolean {
  return (isManager(user?.role) || isAssignee(ticket, user)) && ticket.onHold && ticket.onHoldReason !== "APPROVAL";
}

export const STATUS_ORDER: Ticket["status"][] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "FIRST_LINE_REVIEW",
  "JOB_COMPLETED",
  "FINAL_REVIEW",
  "CLOSED",
];
