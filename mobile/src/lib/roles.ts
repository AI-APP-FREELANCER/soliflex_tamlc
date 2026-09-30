import type { Role } from "@/lib/types";

// Mirrors the role groupings in frontend/src/App.tsx and Sidebar.tsx.
export const HELPDESK_ROLES = new Set<Role>(["EMPLOYEE", "IT_SUPPORT_ENGINEER", "IT_TEAM_LEAD"]);
export const LEGACY_ROLES = new Set<Role>(["MANAGER", "MECHANIC", "IT_TEAM", "PRODUCTION"]);

export function isAdmin(role: Role | undefined): boolean {
  return role === "ADMIN";
}

export function canSeeHelpdesk(role: Role | undefined): boolean {
  return !!role && (isAdmin(role) || HELPDESK_ROLES.has(role));
}

export function canSeeLegacy(role: Role | undefined): boolean {
  return !!role && (isAdmin(role) || LEGACY_ROLES.has(role));
}

export function canSeeUsersAndAudit(role: Role | undefined): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function canSeeHelpdeskDashboard(role: Role | undefined): boolean {
  return role === "IT_TEAM_LEAD" || role === "ADMIN";
}
