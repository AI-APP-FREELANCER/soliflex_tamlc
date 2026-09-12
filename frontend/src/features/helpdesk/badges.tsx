import clsx from "clsx";
import type { HelpdeskCategory, HelpdeskStatus } from "../../lib/types";

const STATUS_STYLES: Record<HelpdeskStatus, string> = {
  OPEN: "bg-soliflex-gray-100 text-soliflex-gray-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-teal-50 text-teal-700",
  CLOSED: "bg-green-50 text-green-700",
  REOPENED: "bg-red-50 text-red-700",
};

export const HELPDESK_STATUS_LABELS: Record<HelpdeskStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export function HelpdeskStatusBadge({ status }: { status: HelpdeskStatus }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLES[status])}>
      {HELPDESK_STATUS_LABELS[status]}
    </span>
  );
}

export const HELPDESK_CATEGORY_LABELS: Record<HelpdeskCategory, string> = {
  LAPTOP_DESKTOP: "Laptop / Desktop",
  PRINTER: "Printer",
  NETWORK: "Network",
  SOFTWARE: "Software",
  ACCESS_REQUEST: "Access Request",
  EMAIL: "Email",
  OTHER: "Other",
};

export function DeadlineBreachedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      Deadline breached
    </span>
  );
}

export function OnHoldBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
      On Hold
    </span>
  );
}

export function MissingDeadlineBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-soliflex-gray-100 px-2.5 py-1 text-xs font-semibold text-soliflex-gray-600">
      No deadline
    </span>
  );
}
