import type { Role } from "@/lib/types";

export const ALL_ROLES: Role[] = [
  "MANAGER",
  "MECHANIC",
  "IT_TEAM",
  "PRODUCTION",
  "ADMIN",
  "EMPLOYEE",
  "IT_SUPPORT_ENGINEER",
  "IT_TEAM_LEAD",
];

const ADMIN_ONLY_ROLES = new Set<Role>(["ADMIN", "IT_TEAM_LEAD", "IT_SUPPORT_ENGINEER"]);

/** Mirrors backend assertRoleCreatable — a convenience only, the server is the real boundary. */
export function assignableRoles(actorRole: Role | undefined): Role[] {
  if (actorRole === "ADMIN") return ALL_ROLES;
  return ALL_ROLES.filter((r) => !ADMIN_ONLY_ROLES.has(r));
}
