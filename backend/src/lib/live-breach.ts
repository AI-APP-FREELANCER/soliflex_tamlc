/**
 * The breach flags (Ticket.slaBreached / HelpdeskTicket.deadlineBreached) are
 * set by a 15-minute cron and are what drives the one-off notifications. For
 * display, a ticket that is past its deadline *right now* must read as
 * breached immediately, so API responses overlay the live state on the flag.
 * Reports use the same rule, so lists and dashboards can never disagree.
 */

const HELPDESK_FINISHED = new Set(["CLOSED", "RESOLVED"]);

// Target-date/SLA tracking is IT only (Oct 2026 maintenance redesign).
export function withLiveSlaBreach<T extends { status: string; workstream?: string; targetCompletionDate: Date | null; slaBreached: boolean }>(ticket: T, now = new Date()): T {
  if (ticket.workstream === "MAINTENANCE") return ticket;
  const pastTarget = ticket.status !== "CLOSED" && ticket.targetCompletionDate !== null && ticket.targetCompletionDate < now;
  return pastTarget && !ticket.slaBreached ? { ...ticket, slaBreached: true } : ticket;
}

export function withLiveDeadlineBreach<T extends { status: string; deadline: Date | null; deadlineBreached: boolean }>(ticket: T, now = new Date()): T {
  const pastDeadline = !HELPDESK_FINISHED.has(ticket.status) && ticket.deadline !== null && ticket.deadline < now;
  return pastDeadline && !ticket.deadlineBreached ? { ...ticket, deadlineBreached: true } : ticket;
}
