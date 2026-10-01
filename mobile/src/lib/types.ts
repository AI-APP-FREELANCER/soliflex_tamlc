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

// --- Legacy tickets module (maintenance/IT) — mirrors frontend/src/lib/types.ts ---

export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "FIRST_LINE_REVIEW"
  | "JOB_COMPLETED"
  | "FINAL_REVIEW"
  | "CLOSED";

export type TicketCategory =
  | "PRODUCTION_MACHINE"
  | "FACTORY_FACILITY"
  | "OTHER_MACHINE"
  | "WORKSTATION"
  | "LAPTOP"
  | "NETWORK_GEAR"
  | "SERVER"
  | "SOFTWARE";

export type OnHoldReason = "VENDOR" | "MATERIAL" | "APPROVAL";
export type AttachmentType = "PRE_FIX_PHOTO" | "POST_FIX_PHOTO" | "INVOICE" | "OTHER";

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  author?: NamedRef;
  body: string;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  type: AttachmentType;
  fileUrl: string;
  uploadedById: string;
  uploadedBy?: NamedRef;
  createdAt: string;
}

export interface TicketCostEntry {
  id: string;
  ticketId: string;
  description: string;
  amount: number;
  sparePartUsed: boolean;
  createdAt: string;
}

export interface TicketStatusHistoryEntry {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedById: string;
  changedBy?: NamedRef;
  comment: string | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  workstream: Workstream;
  category: TicketCategory;
  title: string;
  description: string;
  plantLocation: string | null;
  maintenanceAssetId: string | null;
  itAssetId: string | null;
  status: TicketStatus;
  priority: Priority | null;
  onHold: boolean;
  onHoldReason: OnHoldReason | null;
  onHoldDetail: string | null;
  onHoldSince: string | null;
  reportedById: string;
  reportedBy?: NamedRef;
  assignedToId: string | null;
  assignedTo?: NamedRef | null;
  managerId: string | null;
  manager?: NamedRef | null;
  diagnosis: string | null;
  recommendedFix: string | null;
  approvedById: string | null;
  approvedBy?: NamedRef | null;
  approvedAt: string | null;
  effortEstimateHours: number | null;
  targetCompletionDate: string | null;
  slaBreached: boolean;
  actualCost: number | null;
  closedById: string | null;
  closedBy?: NamedRef | null;
  closedAt: string | null;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
  costEntries?: TicketCostEntry[];
  statusHistory?: TicketStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilter extends DateRangeValue {
  workstream?: Workstream;
  status?: TicketStatus;
  assignedToId?: string;
  reportedById?: string;
  priority?: Priority;
  onHold?: boolean;
  search?: string;
}

// --- Assets module (maintenance + IT inventory) ---

export type AssetStatus = "ACTIVE" | "DOWN" | "RETIRED";
export type AssetType = "maintenance" | "it";

export interface AssetPhoto {
  id: string;
  assetId: string;
  fileUrl: string;
  caption: string | null;
  uploadedAt: string;
}

export interface AssetInvoice {
  id: string;
  assetId: string;
  fileUrl: string;
  invoiceNumber: string | null;
  amount: number | null;
  uploadedAt: string;
}

export interface MaintenanceAsset {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  model: string | null;
  manufacturer: string | null;
  plantLocation: string | null;
  specifications: string | null;
  purchaseDate: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  status: AssetStatus;
  statusSince: string | null;
  qrCodeUrl: string | null;
  photos?: AssetPhoto[];
  invoices?: AssetInvoice[];
  createdAt: string;
  updatedAt: string;
}

export interface ITAsset {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  serialNumber: string | null;
  specifications: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  vendor: string | null;
  purchaseDate: string | null;
  warrantyEndDate: string | null;
  licenseExpiryDate: string | null;
  costCenter: string | null;
  assignedToUserId: string | null;
  status: AssetStatus;
  statusSince: string | null;
  qrCodeUrl: string | null;
  invoices?: AssetInvoice[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetFilter {
  category?: string;
  status?: AssetStatus;
  search?: string;
}
