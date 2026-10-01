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

// --- Helpdesk module (mirrors frontend/src/lib/types.ts) ---

export type HelpdeskStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

export type HelpdeskCategory =
  | "LAPTOP_DESKTOP"
  | "PRINTER"
  | "NETWORK"
  | "SOFTWARE"
  | "ACCESS_REQUEST"
  | "EMAIL"
  | "OTHER";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NamedRef {
  id: string;
  name: string;
}

export interface HelpdeskComment {
  id: string;
  ticketId: string;
  authorId: string;
  author?: NamedRef;
  body: string;
  createdAt: string;
}

export interface HelpdeskStatusHistoryEntry {
  id: string;
  ticketId: string;
  fromStatus: HelpdeskStatus | null;
  toStatus: HelpdeskStatus;
  changedById: string;
  changedBy?: NamedRef;
  comment: string | null;
  createdAt: string;
}

export interface HelpdeskTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: HelpdeskCategory;
  status: HelpdeskStatus;
  priority: Priority | null;
  raisedById: string;
  raisedBy?: NamedRef & { role?: Role };
  assignedToId: string | null;
  assignedTo?: (NamedRef & { role?: Role }) | null;
  teamLeadId: string | null;
  teamLead?: NamedRef | null;
  resolvedById: string | null;
  resolvedBy?: NamedRef | null;
  resolvedAt: string | null;
  closedById: string | null;
  closedBy?: NamedRef | null;
  closedAt: string | null;
  deadline: string | null;
  deadlineSetAt: string | null;
  deadlineBreached: boolean;
  onHold: boolean;
  onHoldReason: string | null;
  onHoldSince: string | null;
  itAssetId: string | null;
  comments?: HelpdeskComment[];
  statusHistory?: HelpdeskStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type DateRangePreset = "today" | "this_week" | "mtd" | "last_7_days" | "last_30_days" | "custom";

export interface DateRangeValue {
  range?: DateRangePreset;
  from?: string;
  to?: string;
}

export interface HelpdeskFilter extends DateRangeValue {
  status?: HelpdeskStatus;
  category?: HelpdeskCategory;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
  missingDeadline?: boolean;
}

export interface HelpdeskDashboardStats {
  byStatus: { status: HelpdeskStatus; count: number }[];
  total: number;
  overdueCount: number;
  missingDeadlineCount: number;
  perEngineerWorkload: { engineerId: string; name: string; open: number; inProgress: number; overdue: number }[];
}
