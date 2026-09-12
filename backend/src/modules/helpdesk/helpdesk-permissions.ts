import { Role } from "@prisma/client";
import { ApiError } from "../../middleware/errors";

export interface HelpdeskActor {
  id: string;
  role: Role;
}

/**
 * Jira-like visibility: Employees (and any other legacy role) see only what
 * they raised, engineers see only what's assigned to them, and the Team
 * Lead/Admin see the whole queue.
 */
export function helpdeskVisibilityWhere(actor: HelpdeskActor): Record<string, unknown> {
  if (actor.role === Role.ADMIN || actor.role === Role.IT_TEAM_LEAD) return {};
  if (actor.role === Role.IT_SUPPORT_ENGINEER) return { assignedToId: actor.id };
  return { raisedById: actor.id };
}

export function assertCanView(
  actor: HelpdeskActor,
  ticket: { raisedById: string; assignedToId: string | null }
): void {
  if (actor.role === Role.ADMIN || actor.role === Role.IT_TEAM_LEAD) return;
  if (actor.role === Role.IT_SUPPORT_ENGINEER && ticket.assignedToId === actor.id) return;
  if (ticket.raisedById === actor.id) return;
  throw new ApiError(403, "You do not have access to this ticket");
}
