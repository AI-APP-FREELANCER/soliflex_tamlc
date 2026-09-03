import clsx from "clsx";
import type { Priority, TicketStatus } from "../lib/types";

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-soliflex-gray-100 text-soliflex-gray-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  FIRST_LINE_REVIEW: "bg-purple-50 text-purple-700",
  JOB_COMPLETED: "bg-teal-50 text-teal-700",
  FINAL_REVIEW: "bg-indigo-50 text-indigo-700",
  CLOSED: "bg-green-50 text-green-700",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  FIRST_LINE_REVIEW: "1st Line Review",
  JOB_COMPLETED: "Job Completed",
  FINAL_REVIEW: "Final Review",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-soliflex-gray-100 text-soliflex-gray-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-soliflex-orange-50 text-soliflex-orange-700",
  CRITICAL: "bg-red-50 text-red-700",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-xs text-soliflex-gray-400">No priority</span>;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", PRIORITY_STYLES[priority])}>
      {priority}
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

export function SlaBreachBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      SLA Breached
    </span>
  );
}
