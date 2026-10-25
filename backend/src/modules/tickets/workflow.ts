import { Role, TicketStatus, Workstream } from "@prisma/client";

/**
 * Two independent status machines share the Ticket table (Oct 2026 redesign):
 *
 * IT:          OPEN -> ASSIGNED -> IN_PROGRESS -> CLOSED (+ REOPEN, HOLD/RESUME)
 * Maintenance: OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> (ON_HOLD <-> IN_PROGRESS)
 *              -> VERIFICATION_NEEDED -> CLOSED (via VERIFIED), or back to
 *              IN_PROGRESS (via REJECTED). No approval step, no reopening.
 *
 * FIRST_LINE_REVIEW / JOB_COMPLETED / FINAL_REVIEW / the old CLOSE+approval
 * actions only exist for tickets raised before this redesign; no transition
 * below produces them, but they remain valid `from` history for display.
 */

export type TicketAction =
  // IT only
  | "ASSIGN"
  | "START_PROGRESS"
  | "DIRECT_CLOSE"
  | "HOLD"
  | "RESUME"
  | "REOPEN"
  // Maintenance only
  | "ACKNOWLEDGE"
  | "MAINT_HOLD"
  | "MAINT_RESUME"
  | "MARK_VERIFICATION_NEEDED"
  | "VERIFY_AND_CLOSE"
  | "REJECT_VERIFICATION";

interface TransitionRule {
  from: TicketStatus[];
  to: TicketStatus | null;
  roles: Role[];
  /** actor must also be the ticket's assignee (managers/admins bypass) */
  requireAssignee?: boolean;
}

export const TRANSITIONS: Record<TicketAction, TransitionRule> = {
  ASSIGN: {
    from: [TicketStatus.OPEN],
    to: TicketStatus.ASSIGNED,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  START_PROGRESS: {
    from: [TicketStatus.ASSIGNED, TicketStatus.ACKNOWLEDGED],
    to: TicketStatus.IN_PROGRESS,
    // Manager/Admin can start work on an engineer's behalf (requireAssignee
    // below is bypassed for them, same as every other technician action).
    roles: [Role.MECHANIC, Role.IT_TEAM, Role.MANAGER, Role.ADMIN],
    requireAssignee: true,
  },
  DIRECT_CLOSE: {
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.CLOSED,
    roles: [Role.MANAGER, Role.ADMIN, Role.IT_TEAM],
    requireAssignee: true,
  },
  HOLD: {
    from: [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
    to: null,
    roles: [Role.MANAGER, Role.ADMIN, Role.IT_TEAM],
    requireAssignee: true,
  },
  RESUME: {
    from: [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
    to: null,
    roles: [Role.MANAGER, Role.ADMIN, Role.IT_TEAM],
    requireAssignee: true,
  },
  REOPEN: {
    from: [TicketStatus.CLOSED],
    to: TicketStatus.IN_PROGRESS,
    // Reopening un-closes a ticket - the one action that reverses status
    // rather than moving it forward. Admin has full powers everywhere else,
    // but not this one; only a Manager can reopen.
    roles: [Role.MANAGER],
  },

  ACKNOWLEDGE: {
    // Self-assign (Mechanic) or manager-assign; sets the assignee and status together.
    from: [TicketStatus.OPEN],
    to: TicketStatus.ACKNOWLEDGED,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC],
  },
  MAINT_HOLD: {
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.ON_HOLD,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC],
    requireAssignee: true,
  },
  MAINT_RESUME: {
    from: [TicketStatus.ON_HOLD],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC],
    requireAssignee: true,
  },
  MARK_VERIFICATION_NEEDED: {
    from: [TicketStatus.IN_PROGRESS],
    to: TicketStatus.VERIFICATION_NEEDED,
    roles: [Role.MANAGER, Role.ADMIN, Role.MECHANIC],
    requireAssignee: true,
  },
  VERIFY_AND_CLOSE: {
    from: [TicketStatus.VERIFICATION_NEEDED],
    to: TicketStatus.CLOSED,
    roles: [Role.MANAGER, Role.ADMIN, Role.PRODUCTION],
  },
  REJECT_VERIFICATION: {
    from: [TicketStatus.VERIFICATION_NEEDED],
    to: TicketStatus.IN_PROGRESS,
    roles: [Role.MANAGER, Role.ADMIN, Role.PRODUCTION],
  },
};

const MAINTENANCE_ONLY: Set<TicketAction> = new Set([
  "ACKNOWLEDGE",
  "MAINT_HOLD",
  "MAINT_RESUME",
  "MARK_VERIFICATION_NEEDED",
  "VERIFY_AND_CLOSE",
  "REJECT_VERIFICATION",
]);
const IT_ONLY: Set<TicketAction> = new Set(["ASSIGN", "DIRECT_CLOSE", "HOLD", "RESUME", "REOPEN"]);

export function canPerform(
  action: TicketAction,
  ticket: { status: TicketStatus; workstream: Workstream; assignedToId: string | null; managerId: string | null },
  actor: { id: string; role: Role }
): { allowed: boolean; reason?: string } {
  if (MAINTENANCE_ONLY.has(action) && ticket.workstream !== Workstream.MAINTENANCE) {
    return { allowed: false, reason: "This action is only available for maintenance tickets" };
  }
  if (IT_ONLY.has(action) && ticket.workstream !== Workstream.IT) {
    return { allowed: false, reason: "This action is only available for IT tickets" };
  }
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
  return { allowed: true };
}
