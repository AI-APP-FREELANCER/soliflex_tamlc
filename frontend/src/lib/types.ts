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
export type TicketCategory =
  | "PRODUCTION_MACHINE"
  | "FACTORY_FACILITY"
  | "OTHER_MACHINE"
  | "WORKSTATION"
  | "LAPTOP"
  | "NETWORK_GEAR"
  | "SERVER"
  | "SOFTWARE";
export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "FIRST_LINE_REVIEW"
  | "JOB_COMPLETED"
  | "FINAL_REVIEW"
  | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type OnHoldReason = "VENDOR" | "MATERIAL" | "APPROVAL";
export type AttachmentType = "PRE_FIX_PHOTO" | "POST_FIX_PHOTO" | "INVOICE" | "OTHER";
export type AssetStatus = "ACTIVE" | "DOWN" | "RETIRED";
export type MaintenanceAssetCategory = "PRODUCTION_MACHINE" | "PLANT_EQUIPMENT" | "PERIPHERAL_ATTACHMENT" | "PHYSICAL_TOOL";
export type ITAssetCategory = "WORKSTATION" | "LAPTOP" | "NETWORK_GEAR" | "SERVER" | "SOFTWARE_LICENSE";
export type NotificationType =
  | "TICKET_CREATED"
  | "TICKET_ASSIGNED"
  | "STATUS_CHANGED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECIDED"
  | "SLA_BREACHED"
  | "COMMENT_ADDED"
  | "ON_HOLD"
  | "RESUMED"
  | "TICKET_CLOSED"
  | "ASSET_EXPIRING"
  | "ASSET_DOWNTIME"
  | "HELPDESK_TICKET_CREATED"
  | "HELPDESK_TICKET_ASSIGNED"
  | "HELPDESK_STATUS_CHANGED"
  | "HELPDESK_COMMENT_ADDED"
  | "HELPDESK_TICKET_RESOLVED"
  | "HELPDESK_TICKET_CLOSED"
  | "HELPDESK_DEADLINE_BREACHED"
  | "HELPDESK_DEADLINE_MISSING";

export type HelpdeskCategory = "LAPTOP_DESKTOP" | "PRINTER" | "NETWORK" | "SOFTWARE" | "ACCESS_REQUEST" | "EMAIL" | "OTHER";
export type HelpdeskStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

export interface UserSummary {
  id: string;
  name: string;
  role?: Role;
}

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

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  type: AttachmentType;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: UserSummary;
  uploadedAt: string;
}

export interface TicketCostEntry {
  id: string;
  description: string;
  amount: number;
  sparePartUsed: boolean;
  createdAt: string;
}

export interface TicketStatusHistoryEntry {
  id: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedBy: UserSummary;
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
  reportedBy: UserSummary;
  assignedToId: string | null;
  assignedTo: UserSummary | null;
  managerId: string | null;
  manager: UserSummary | null;
  diagnosis: string | null;
  recommendedFix: string | null;
  approvedById: string | null;
  approvedBy: UserSummary | null;
  approvedAt: string | null;
  effortEstimateHours: number | null;
  targetCompletionDate: string | null;
  slaBreached: boolean;
  actualCost: number | null;
  closedById: string | null;
  closedBy: UserSummary | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  costEntries: TicketCostEntry[];
  statusHistory: TicketStatusHistoryEntry[];
}

export interface MaintenanceAssetPhoto {
  id: string;
  fileUrl: string;
  caption: string | null;
  uploadedAt: string;
}

export interface MaintenanceAssetInvoice {
  id: string;
  fileUrl: string;
  invoiceNumber: string | null;
  amount: number | null;
  uploadedAt: string;
}

export interface MaintenanceAsset {
  id: string;
  itemCode: string;
  name: string;
  category: MaintenanceAssetCategory;
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
  photos: MaintenanceAssetPhoto[];
  invoices: MaintenanceAssetInvoice[];
  createdAt: string;
}

export interface ITAssetInvoice {
  id: string;
  fileUrl: string;
  invoiceNumber: string | null;
  amount: number | null;
  uploadedAt: string;
}

export interface ITAsset {
  id: string;
  itemCode: string;
  name: string;
  category: ITAssetCategory;
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
  invoices: ITAssetInvoice[];
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  open: number;
  closed: number;
  onHold: number;
  slaBreached: number;
  avgResolutionHours: number;
  totalCost: number;
  byStatus: { status: TicketStatus; count: number }[];
  byPriority: { priority: Priority | null; count: number }[];
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  changedBy: UserSummary;
  changedAt: string;
}

export interface HelpdeskComment {
  id: string;
  ticketId: string;
  authorId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export interface HelpdeskStatusHistoryEntry {
  id: string;
  fromStatus: HelpdeskStatus | null;
  toStatus: HelpdeskStatus;
  changedBy: UserSummary;
  comment: string | null;
  createdAt: string;
}

export interface HelpdeskTicket {
  id: string;
  ticketNumber: string;
  category: HelpdeskCategory;
  title: string;
  description: string;
  priority: Priority | null;
  status: HelpdeskStatus;
  onHold: boolean;
  onHoldReason: string | null;
  onHoldSince: string | null;
  raisedById: string;
  raisedBy: UserSummary;
  assignedToId: string | null;
  assignedTo: UserSummary | null;
  teamLeadId: string | null;
  teamLead: UserSummary | null;
  itAssetId: string | null;
  deadline: string | null;
  deadlineSetAt: string | null;
  deadlineBreached: boolean;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolvedBy: UserSummary | null;
  closedAt: string | null;
  closedById: string | null;
  closedBy: UserSummary | null;
  createdAt: string;
  updatedAt: string;
  comments: HelpdeskComment[];
  statusHistory: HelpdeskStatusHistoryEntry[];
}

export interface HelpdeskDashboardStats {
  byStatus: { status: HelpdeskStatus; count: number }[];
  total: number;
  overdueCount: number;
  missingDeadlineCount: number;
  perEngineerWorkload: { engineerId: string; name: string; open: number; inProgress: number; overdue: number }[];
}
