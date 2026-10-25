import clsx from "clsx";
import type { ChecklistAnswer, DelayReason, MachineStatus, Priority, ProblemType, QualityRating, TicketStatus } from "../lib/types";

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-soliflex-gray-100 text-soliflex-gray-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  ACKNOWLEDGED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  ON_HOLD: "bg-orange-50 text-orange-700",
  FIRST_LINE_REVIEW: "bg-purple-50 text-purple-700",
  JOB_COMPLETED: "bg-teal-50 text-teal-700",
  FINAL_REVIEW: "bg-indigo-50 text-indigo-700",
  VERIFICATION_NEEDED: "bg-purple-50 text-purple-700",
  VERIFIED: "bg-teal-50 text-teal-700",
  REJECTED: "bg-red-50 text-red-700",
  CLOSED: "bg-green-50 text-green-700",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  FIRST_LINE_REVIEW: "1st Line Review",
  JOB_COMPLETED: "Job Completed",
  FINAL_REVIEW: "Final Review",
  VERIFICATION_NEEDED: "Verification Needed",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

/** Label for any ticket status, including Helpdesk-only ones (Resolved/Reopened) that appear in combined IT reports. */
export function statusLabel(status: string): string {
  if (status === "RESOLVED") return "Resolved";
  if (status === "REOPENED") return "Reopened";
  return STATUS_LABELS[status as TicketStatus] ?? status;
}

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

export function MachineStatusBadge({ status }: { status: MachineStatus | null }) {
  if (!status) return null;
  const running = status === "RUNNING";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        running ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", running ? "bg-green-500" : "bg-red-500")} />
      {MACHINE_STATUS_LABELS[status]}
    </span>
  );
}

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

export function QualityRatingBadge({ rating }: { rating: QualityRating | null }) {
  if (!rating) return null;
  const styles: Record<QualityRating, string> = {
    EXCELLENT: "bg-green-50 text-green-700",
    GOOD: "bg-teal-50 text-teal-700",
    FAIR: "bg-amber-50 text-amber-700",
    POOR: "bg-red-50 text-red-700",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", styles[rating])}>{QUALITY_RATING_LABELS[rating]}</span>;
}
