import { Role } from "@prisma/client";

/** Roles that work in the Maintenance / IT board (tickets, assets, reports) - ADMIN is the superuser. */
export const LEGACY_ROLES: Role[] = [Role.MANAGER, Role.MECHANIC, Role.IT_TEAM, Role.PRODUCTION, Role.ADMIN];

/** Roles that may create/edit/promote accounts with elevated access. */
export const ADMIN_ONLY_ROLES = new Set<Role>([Role.ADMIN, Role.IT_TEAM_LEAD, Role.IT_SUPPORT_ENGINEER]);
