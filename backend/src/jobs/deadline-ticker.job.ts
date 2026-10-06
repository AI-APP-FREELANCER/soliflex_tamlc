import { HelpdeskStatus, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { emitDataChanged } from "../sockets";

/**
 * Breach/overdue figures are derived from "deadline < now", so they change the
 * moment a deadline passes even though no row is written. This ticker spots
 * deadlines crossed since the last tick and tells clients to refetch, so
 * dashboards flip at (almost exactly) the deadline instead of on the next poll.
 */
export async function deadlinesCrossed(from: Date, to: Date): Promise<boolean> {
  const window = { gt: from, lte: to };
  const [legacy, helpdesk] = await Promise.all([
    prisma.ticket.count({ where: { status: { not: TicketStatus.CLOSED }, targetCompletionDate: window } }),
    prisma.helpdeskTicket.count({ where: { status: { notIn: [HelpdeskStatus.CLOSED, HelpdeskStatus.RESOLVED] }, deadline: window } }),
  ]);
  return legacy + helpdesk > 0;
}

const TICK_MS = 15_000;

export function startDeadlineTicker() {
  let last = new Date();
  setInterval(() => {
    const now = new Date();
    const from = last;
    last = now;
    deadlinesCrossed(from, now)
      .then((crossed) => crossed && emitDataChanged("deadlines"))
      .catch((err) => console.error("[deadline-ticker] failed", err));
  }, TICK_MS);
}
