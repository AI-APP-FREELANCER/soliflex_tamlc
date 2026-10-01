import type { HelpdeskCategory, HelpdeskStatus, Priority } from "@/lib/types";

export const HELPDESK_STATUS_LABELS: Record<HelpdeskStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

// Hex pairs (bg, text) — NativeWind arbitrary-value classes read poorly for
// dynamic lookups, so these drive inline styles on the badge instead.
export const HELPDESK_STATUS_COLORS: Record<HelpdeskStatus, { bg: string; text: string }> = {
  OPEN: { bg: "#F3F4F6", text: "#374151" },
  ASSIGNED: { bg: "#EFF6FF", text: "#1D4ED8" },
  IN_PROGRESS: { bg: "#FFFBEB", text: "#B45309" },
  RESOLVED: { bg: "#F0FDFA", text: "#0F766E" },
  CLOSED: { bg: "#F0FDF4", text: "#15803D" },
  REOPENED: { bg: "#FEF2F2", text: "#B91C1C" },
};

export const HELPDESK_CATEGORY_LABELS: Record<HelpdeskCategory, string> = {
  LAPTOP_DESKTOP: "Laptop / Desktop",
  PRINTER: "Printer",
  NETWORK: "Network",
  SOFTWARE: "Software",
  ACCESS_REQUEST: "Access Request",
  EMAIL: "Email",
  OTHER: "Other",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  LOW: { bg: "#F3F4F6", text: "#374151" },
  MEDIUM: { bg: "#EFF6FF", text: "#1D4ED8" },
  HIGH: { bg: "#FFFBEB", text: "#B45309" },
  CRITICAL: { bg: "#FEF2F2", text: "#B91C1C" },
};
