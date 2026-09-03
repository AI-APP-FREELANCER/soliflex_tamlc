import cron from "node-cron";
import { NotificationType, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notify } from "../modules/notifications/notifications.service";

async function checkSlaBreaches() {
  const overdueTickets = await prisma.ticket.findMany({
    where: {
      status: { not: TicketStatus.CLOSED },
      slaBreached: false,
      targetCompletionDate: { lt: new Date() },
    },
  });

  for (const ticket of overdueTickets) {
    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id: ticket.id }, data: { slaBreached: true } });
      if (ticket.managerId) {
        await notify(tx, ticket.managerId, NotificationType.SLA_BREACHED, `SLA breached for ${ticket.ticketNumber}: past target completion date`, `/tickets/${ticket.id}`);
      }
      if (ticket.assignedToId) {
        await notify(tx, ticket.assignedToId, NotificationType.SLA_BREACHED, `SLA breached for ${ticket.ticketNumber}: past target completion date`, `/tickets/${ticket.id}`);
      }
    });
  }

  if (overdueTickets.length > 0) {
    console.log(`[sla-check] flagged ${overdueTickets.length} ticket(s) as SLA breached`);
  }
}

export function startSlaCheckJob() {
  // every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    checkSlaBreaches().catch((err) => console.error("[sla-check] failed", err));
  });
  // also run once shortly after boot
  setTimeout(() => checkSlaBreaches().catch((err) => console.error("[sla-check] failed", err)), 5000);
}
