import type { AttachmentType, ChecklistAnswer, DelayReason, HelpdeskStatus, MachineStatus, OnHoldReason, ProblemType, QualityRating, TicketCategory, TicketStatus } from "@/lib/types";
import { HELPDESK_STATUS_COLORS, HELPDESK_STATUS_LABELS } from "@/features/helpdesk/badges";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  FIRST_LINE_REVIEW: "First Line Review",
  JOB_COMPLETED: "Job Completed",
  FINAL_REVIEW: "Final Review",
  VERIFICATION_NEEDED: "Verification Needed",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export const TICKET_STATUS_COLORS: Record<TicketStatus, { bg: string; text: string }> = {
  OPEN: { bg: "#F3F4F6", text: "#374151" },
  ASSIGNED: { bg: "#EFF6FF", text: "#1D4ED8" },
  ACKNOWLEDGED: { bg: "#EFF6FF", text: "#1D4ED8" },
  IN_PROGRESS: { bg: "#FFFBEB", text: "#B45309" },
  ON_HOLD: { bg: "#FFF7ED", text: "#C2410C" },
  FIRST_LINE_REVIEW: { bg: "#F5F3FF", text: "#6D28D9" },
  JOB_COMPLETED: { bg: "#ECFEFF", text: "#0E7490" },
  FINAL_REVIEW: { bg: "#FDF2F8", text: "#BE185D" },
  VERIFICATION_NEEDED: { bg: "#F5F3FF", text: "#6D28D9" },
  VERIFIED: { bg: "#ECFEFF", text: "#0E7490" },
  REJECTED: { bg: "#FEF2F2", text: "#B91C1C" },
  CLOSED: { bg: "#F0FDF4", text: "#15803D" },
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  PRODUCTION_MACHINE: "Production Machine",
  FACTORY_FACILITY: "Factory / Facility",
  OTHER_MACHINE: "Other Machine",
  WORKSTATION: "Workstation",
  LAPTOP: "Laptop",
  NETWORK_GEAR: "Network Gear",
  SERVER: "Server",
  SOFTWARE: "Software",
};

export const ON_HOLD_REASON_LABELS: Record<OnHoldReason, string> = {
  VENDOR: "Waiting for Vendor",
  MATERIAL: "Waiting for Material (ETA)",
  APPROVAL: "Waiting for Approval",
};

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  PRE_FIX_PHOTO: "Pre-fix photo",
  POST_FIX_PHOTO: "Post-fix photo",
  INVOICE: "Invoice",
  OTHER: "Other",
};

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  ELECTRICAL: "Electrical",
  MECHANICAL: "Mechanical",
  PNEUMATIC: "Pneumatic",
  HYDRAULIC: "Hydraulic",
  OTHERS: "Others",
};

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  RUNNING: "Machine Running",
  STOPPED: "Machine Stopped",
};

export const DELAY_REASON_LABELS: Record<DelayReason, string> = {
  TECHNICIAN_NOT_AVAILABLE: "Technician not available",
  WAITING_FOR_SPARES: "Waiting for spares",
  WAITING_FOR_EXTERNAL_SERVICE: "Waiting for external service",
  NEED_TECHNICAL_SUPPORT: "Need technical support",
  OTHERS: "Others",
};

export const CHECKLIST_ANSWER_LABELS: Record<ChecklistAnswer, string> = {
  YES: "Yes",
  NO: "No",
  NA: "N/A",
};

export const QUALITY_RATING_LABELS: Record<QualityRating, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

const FALLBACK_STATUS_COLORS = { bg: "#F3F4F6", text: "#374151" };

/** Label for any ticket status, including Helpdesk-only ones (Resolved/Reopened) that appear in combined IT reports. */
export function anyStatusLabel(status: string): string {
  return TICKET_STATUS_LABELS[status as TicketStatus] ?? HELPDESK_STATUS_LABELS[status as HelpdeskStatus] ?? status;
}

export function anyStatusColors(status: string): { bg: string; text: string } {
  return TICKET_STATUS_COLORS[status as TicketStatus] ?? HELPDESK_STATUS_COLORS[status as HelpdeskStatus] ?? FALLBACK_STATUS_COLORS;
}
