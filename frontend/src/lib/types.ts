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
  | "ASSIGNED" // IT only
  | "IN_PROGRESS"
  | "FIRST_LINE_REVIEW" // legacy maintenance workflow - historical tickets only
  | "JOB_COMPLETED" // legacy maintenance workflow - historical tickets only
  | "FINAL_REVIEW" // legacy maintenance workflow - historical tickets only
  | "ACKNOWLEDGED" // maintenance only
  | "ON_HOLD" // maintenance only
  | "VERIFICATION_NEEDED" // maintenance only
  | "VERIFIED" // maintenance only
  | "REJECTED" // maintenance only
  | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProblemType = "ELECTRICAL" | "MECHANICAL" | "PNEUMATIC" | "HYDRAULIC" | "OTHERS";
export type MachineStatus = "RUNNING" | "STOPPED";
export type DelayReason = "TECHNICIAN_NOT_AVAILABLE" | "WAITING_FOR_SPARES" | "WAITING_FOR_EXTERNAL_SERVICE" | "NEED_TECHNICAL_SUPPORT" | "OTHERS";
export type ChecklistAnswer = "YES" | "NO" | "NA";
export type QualityRating = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
export type OnHoldReason = "VENDOR" | "MATERIAL" | "APPROVAL";
export type AttachmentType = "PRE_FIX_PHOTO" | "POST_FIX_PHOTO" | "INVOICE" | "OTHER";
export type AssetStatus = "ACTIVE" | "DOWN" | "RETIRED";
// Free text, not a fixed list — see backend/src/lib/normalize-category.ts.
export type MaintenanceAssetCategory = string;
export type ITAssetCategory = string;
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
  | "HELPDESK_DEADLINE_MISSING"
  | "VERIFICATION_NEEDED"
  | "VERIFICATION_REJECTED";

export type HelpdeskCategory = "LAPTOP_DESKTOP" | "PRINTER" | "NETWORK" | "SOFTWARE" | "ACCESS_REQUEST" | "EMAIL" | "OTHER";
export type HelpdeskStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

export type FixType = "SPARE_PART_REPLACEMENT" | "MINOR_ADJUSTMENT";

export interface UserSummary {
  id: string;
  name: string;
  role?: Role;
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  /** Email and mobile number are both sign-in identifiers; at least one is set. */
  email: string | null;
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

export interface NamedRef {
  id: string;
  name: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  workstream: Workstream;
  category: TicketCategory;
  /** Removed from the maintenance ticket form (Oct 2026) - null for every new maintenance ticket. IT still collects it. */
  title: string | null;
  /** displayTitle: computed server-side fallback (title, or a composed label) - always safe to render. */
  displayTitle: string;
  description: string;
  plantLocation: string | null;
  maintenanceAssetId: string | null;
  /** The machine (maintenance asset) linked via maintenanceAssetId, joined server-side for display. */
  machine: MachineSummary | null;
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
  fixType: FixType | null;
  estimatedCost: number | null;
  approvalRequired: boolean;
  approvedById: string | null;
  approvedBy: UserSummary | null;
  approvedAt: string | null;
  effortEstimateHours: number | null;
  /** IT only - maintenance no longer tracks a target date or overdue/SLA breach. */
  targetCompletionDate: string | null;
  slaBreached: boolean;
  actualCost: number | null;
  closedById: string | null;
  closedBy: UserSummary | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // --- Maintenance-only fields (Oct 2026 redesign) ---
  plantId: string | null;
  plant: NamedRef | null;
  departmentId: string | null;
  department: NamedRef | null;
  problemType: ProblemType | null;
  machineStatus: MachineStatus | null;
  delayReason: DelayReason | null;
  delayNotes: string | null;
  checklistToolsReclaimed: ChecklistAnswer | null;
  checklistMachineCleaned: ChecklistAnswer | null;
  checklistCableRouting: ChecklistAnswer | null;
  qualityRating: QualityRating | null;
  qualityFeedback: string | null;
  productionCertified: boolean;
  productionCertifiedAt: string | null;
  productionCertifiedBy: UserSummary | null;

  comments: TicketComment[];
  attachments: TicketAttachment[];
  costEntries: TicketCostEntry[];
  statusHistory: TicketStatusHistoryEntry[];
}

export interface Plant {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceAnalytics {
  ticketCount: number;
  avgHoursByStatus: { status: string; avgHours: number; count: number }[];
  avgTotalResolutionHours: number;
  avgDowntimeHours: number;
  byProblemType: { problemType: string; count: number }[];
  byPlant: { plant: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  byMachineStatus: { machineStatus: string; count: number }[];
  byDelayReason: { delayReason: string; count: number }[];
  checklistCompliance: { field: string; yes: number; no: number; na: number }[];
  qualityRatings: { rating: string; count: number }[];
  rejectedCount: number;
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

/** Lightweight machine shape used by the ticket Machine Name picker and the ticket's own `machine` field. */
export interface MachineSummary {
  id: string;
  itemCode: string;
  name: string;
  category: MaintenanceAssetCategory;
  model: string | null;
  manufacturer: string | null;
  plantLocation: string | null;
  powerCapacity: string | null;
  status: AssetStatus;
}

export interface MaintenanceAsset {
  id: string;
  itemCode: string;
  name: string;
  category: MaintenanceAssetCategory;
  model: string | null;
  manufacturer: string | null;
  plantLocation: string | null;
  powerCapacity: string | null;
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

export interface SourceStats {
  total: number;
  open: number;
  closed: number;
  onHold: number;
  slaBreached: number;
  overdue: number;
}

export interface DashboardStats extends SourceStats {
  avgResolutionHours: number;
  totalCost: number;
  /** Mixed legacy + Helpdesk statuses on the IT workstream, so this is a plain string. */
  byStatus: { status: string; count: number }[];
  byPriority: { priority: Priority | null; count: number }[];
  sources: { tickets: SourceStats; helpdesk: SourceStats | null };
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
