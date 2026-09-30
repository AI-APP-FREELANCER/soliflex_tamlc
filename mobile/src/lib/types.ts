// Mirrors frontend/src/lib/types.ts — kept in sync by hand (no shared
// package between web and mobile, matching the existing backend/frontend
// split-repo convention).

export type Role =
  | "MANAGER"
  | "MECHANIC"
  | "IT_TEAM"
  | "PRODUCTION"
  | "ADMIN"
  | "EMPLOYEE"
  | "IT_SUPPORT_ENGINEER"
  | "IT_TEAM_LEAD";

export type Workstream = "MAINTENANCE" | "IT";

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  workstream: Workstream | null;
  department: string | null;
  phone: string | null;
  active: boolean;
  mustResetPassword: boolean;
  createdAt: string;
}
