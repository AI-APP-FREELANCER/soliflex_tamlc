import { Role, Workstream } from "@prisma/client";

/**
 * Which workstream's tickets a board user works in. Maintenance and IT are
 * separate workflows, so each user only sees their own:
 *   - Mechanic / Production -> Maintenance
 *   - IT Team               -> IT
 *   - Manager               -> their assigned workstream (both if none is set)
 *   - Admin                 -> both
 * Returns null when the user may see both.
 */
export function workstreamScope(user: { role: Role; workstream: Workstream | null }): Workstream | null {
  switch (user.role) {
    case Role.MECHANIC:
    case Role.PRODUCTION:
      return Workstream.MAINTENANCE;
    case Role.IT_TEAM:
      return Workstream.IT;
    case Role.MANAGER:
      return user.workstream ?? null;
    default:
      return null;
  }
}
