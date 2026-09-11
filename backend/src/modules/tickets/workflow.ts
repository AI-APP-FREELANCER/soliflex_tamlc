import { Role, TicketStatus } from "@prisma/client";

/**
 * Core status flow (spec §4):
 * OPEN -> ASSIGNED -> IN_PROGRESS -> FIRST_LINE_REVIEW -> JOB_COMPLETED -> FINAL_REVIEW -> CLOSED
 *
 * On-hold (Waiting for Vendor / Material / Approval) is modeled as an
 * orthogonal flag on top of `status` rather than a distinct status value, so
 * resuming restores the ticket to whatever status it was in before the hold.
 */

export type TicketAction =
  | "ASSIGN"
  | "START_PROGRESS"
  | "SUBMIT_RECOMMENDATION"
  | "APPROVE_RECOMMENDATION"
  | "REJECT_RECOMMENDATION"
  | "MARK_FIRST_LINE_REVIEW"
  | "MARK_JOB_COMPLETED"
  | "MARK_FINAL_REVIEW"
  | "CLOSE"
  | "HOLD"
  | "RESUME"
  | "REOPEN";

interface TransitionRule {
  from: TicketStatus[];
  to: TicketStatus | null; // null = no status change (e.g. submitting a recommendation)
  roles: Role[];
  /** actor must also be the ticket's assignee (in addition to having the role) */
  requireAssignee?: boolean;
  /** actor must also be the ticket's manager */
  requireManager?: boolean;
}

export const TRANSITIONS: Record<TicketAction, TransitionRule> = {
  ASSIGN: {
    from: [TicketStatus.OPEN],
    to: TicketStatus.ASSIGNED,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  START_PROGRESS: {
    from: [TicketStatus.ASSIGNED],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MECHANIC, Role.IT_TEAM],
    requireAssignee: true,
  },
  SUBMIT_RECOMMENDATION: {
    // diagnosis + recommended fix logged, ticket goes on-hold awaiting manager approval
    from: [TicketStatus.IN_PROGRESS],
    to: null,
    roles: [Role.MECHANIC, Role.IT_TEAM],
    requireAssignee: true,
  },
  APPROVE_RECOMMENDATION: {
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  REJECT_RECOMMENDATION: {
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  MARK_FIRST_LINE_REVIEW: {
    // fix executed + post-fix photos uploaded
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.FIRST_LINE_REVIEW,
    roles: [Role.MECHANIC, Role.IT_TEAM],
    requireAssignee: true,
  },
  MARK_JOB_COMPLETED: {
    from: [TicketStatus.FIRST_LINE_REVIEW],
    to: TicketStatus.JOB_COMPLETED,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC, Role.IT_TEAM],
  },
  MARK_FINAL_REVIEW: {
    from: [TicketStatus.JOB_COMPLETED],
    to: TicketStatus.FINAL_REVIEW,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  CLOSE: {
    from: [TicketStatus.FINAL_REVIEW],
    to: TicketStatus.CLOSED,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  HOLD: {
    from: [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.FIRST_LINE_REVIEW, TicketStatus.JOB_COMPLETED, TicketStatus.FINAL_REVIEW],
    to: null,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC, Role.IT_TEAM],
  },
  RESUME: {
    from: [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.FIRST_LINE_REVIEW, TicketStatus.JOB_COMPLETED, TicketStatus.FINAL_REVIEW],
    to: null,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC, Role.IT_TEAM],
  },
  REOPEN: {
    from: [TicketStatus.FIRST_LINE_REVIEW, TicketStatus.JOB_COMPLETED, TicketStatus.FINAL_REVIEW],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MANAGER, Role.ADMIN],
  },
};

export function canPerform(
  action: TicketAction,
  ticket: { status: TicketStatus; assignedToId: string | null; managerId: string | null },
  actor: { id: string; role: Role }
): { allowed: boolean; reason?: string } {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(ticket.status)) {
    return { allowed: false, reason: `Ticket must be in one of [${rule.from.join(", ")}] for this action` };
  }
  if (!rule.roles.includes(actor.role)) {
    return { allowed: false, reason: "Your role cannot perform this action" };
  }
  if (rule.requireAssignee && ticket.assignedToId !== actor.id && actor.role !== Role.MANAGER && actor.role !== Role.ADMIN) {
    return { allowed: false, reason: "Only the assigned technician can perform this action" };
  }
  if (rule.requireManager && ticket.managerId !== actor.id) {
    return { allowed: false, reason: "Only the owning manager can perform this action" };
  }
  return { allowed: true };
}
