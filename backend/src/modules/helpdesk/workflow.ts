import { HelpdeskStatus, Role } from "@prisma/client";

/**
 * Independent, simpler Jira-like flow for company IT-helpdesk tickets:
 * OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED, with REOPENED as an
 * escape hatch back into the queue. On-hold is an orthogonal flag (mirrors
 * Ticket.onHold), not a status value. Deliberately not shared with the
 * maintenance/asset Ticket workflow (workflow.ts in ../tickets), which is
 * tuned for physical-asset repair sign-off.
 */

export type HelpdeskAction =
  | "ASSIGN"
  | "START_PROGRESS"
  | "HOLD"
  | "RESUME"
  | "RESOLVE"
  | "REOPEN"
  | "CLOSE";

interface TransitionRule {
  from: HelpdeskStatus[];
  to: HelpdeskStatus | null; // null = no status change (hold/resume)
  roles: Role[];
  /** actor must also be the ticket's assignee (bypassed for IT_TEAM_LEAD/ADMIN) */
  requireAssignee?: boolean;
  /** actor may also be the ticket's raiser, regardless of role */
  allowRaiser?: boolean;
}

export const TRANSITIONS: Record<HelpdeskAction, TransitionRule> = {
  ASSIGN: {
    from: [HelpdeskStatus.OPEN, HelpdeskStatus.ASSIGNED, HelpdeskStatus.REOPENED],
    to: HelpdeskStatus.ASSIGNED,
    roles: [Role.IT_TEAM_LEAD, Role.ADMIN],
  },
  START_PROGRESS: {
    from: [HelpdeskStatus.ASSIGNED],
    to: HelpdeskStatus.IN_PROGRESS,
    roles: [Role.IT_SUPPORT_ENGINEER, Role.IT_TEAM_LEAD, Role.ADMIN],
    requireAssignee: true,
  },
  HOLD: {
    from: [HelpdeskStatus.ASSIGNED, HelpdeskStatus.IN_PROGRESS],
    to: null,
    roles: [Role.IT_SUPPORT_ENGINEER, Role.IT_TEAM_LEAD, Role.ADMIN],
    requireAssignee: true,
  },
  RESUME: {
    from: [HelpdeskStatus.ASSIGNED, HelpdeskStatus.IN_PROGRESS],
    to: null,
    roles: [Role.IT_SUPPORT_ENGINEER, Role.IT_TEAM_LEAD, Role.ADMIN],
    requireAssignee: true,
  },
  RESOLVE: {
    from: [HelpdeskStatus.IN_PROGRESS],
    to: HelpdeskStatus.RESOLVED,
    roles: [Role.IT_SUPPORT_ENGINEER, Role.IT_TEAM_LEAD, Role.ADMIN],
    requireAssignee: true,
  },
  REOPEN: {
    from: [HelpdeskStatus.RESOLVED, HelpdeskStatus.CLOSED],
    to: HelpdeskStatus.REOPENED,
    roles: [Role.IT_TEAM_LEAD, Role.ADMIN],
    allowRaiser: true,
  },
  CLOSE: {
    from: [HelpdeskStatus.RESOLVED],
    to: HelpdeskStatus.CLOSED,
    roles: [Role.IT_TEAM_LEAD, Role.ADMIN],
  },
};

export function canPerform(
  action: HelpdeskAction,
  ticket: { status: HelpdeskStatus; raisedById: string; assignedToId: string | null },
  actor: { id: string; role: Role }
): { allowed: boolean; reason?: string } {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(ticket.status)) {
    return { allowed: false, reason: `Ticket must be in one of [${rule.from.join(", ")}] for this action` };
  }
  const hasRole = rule.roles.includes(actor.role);
  const isRaiser = rule.allowRaiser && ticket.raisedById === actor.id;
  if (!hasRole && !isRaiser) {
    return { allowed: false, reason: "Your role cannot perform this action" };
  }
  if (hasRole && rule.requireAssignee && ticket.assignedToId !== actor.id && actor.role !== Role.IT_TEAM_LEAD && actor.role !== Role.ADMIN) {
    return { allowed: false, reason: "Only the assigned engineer can perform this action" };
  }
  return { allowed: true };
}
