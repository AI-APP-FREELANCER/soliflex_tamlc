import cron from "node-cron";
import { HelpdeskStatus, NotificationType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notify } from "../modules/notifications/notifications.service";

async function checkDeadlineBreaches() {
  const overdue = await prisma.helpdeskTicket.findMany({
    where: {
      status: { notIn: [HelpdeskStatus.CLOSED, HelpdeskStatus.RESOLVED] },
      deadlineBreached: false,
      deadline: { lt: new Date() },
    },
  });

  for (const ticket of overdue) {
    await prisma.$transaction(async (tx) => {
      await tx.helpdeskTicket.update({ where: { id: ticket.id }, data: { deadlineBreached: true } });
      const leads = await tx.user.findMany({ where: { role: { in: [Role.IT_TEAM_LEAD, Role.ADMIN] }, active: true } });
      const recipients = new Set([ticket.raisedById, ticket.assignedToId, ...leads.map((l) => l.id)].filter(Boolean) as string[]);
      for (const userId of recipients) {
        await notify(tx, userId, NotificationType.HELPDESK_DEADLINE_BREACHED, `Deadline passed for helpdesk ticket ${ticket.ticketNumber}`, `/helpdesk/${ticket.id}`);
      }
    });
  }

  if (overdue.length > 0) {
    console.log(`[helpdesk-deadline-check] flagged ${overdue.length} ticket(s) as deadline breached`);
  }
}

async function checkMissingDeadlines() {
  const missing = await prisma.helpdeskTicket.findMany({
    where: {
      status: { in: [HelpdeskStatus.ASSIGNED, HelpdeskStatus.IN_PROGRESS] },
      deadline: null,
      missingDeadlineAlertedAt: null,
    },
  });

  for (const ticket of missing) {
    await prisma.$transaction(async (tx) => {
      await tx.helpdeskTicket.update({ where: { id: ticket.id }, data: { missingDeadlineAlertedAt: new Date() } });
      const leads = await tx.user.findMany({ where: { role: { in: [Role.IT_TEAM_LEAD, Role.ADMIN] }, active: true } });
      for (const lead of leads) {
        await notify(tx, lead.id, NotificationType.HELPDESK_DEADLINE_MISSING, `${ticket.ticketNumber} is assigned but has no deadline set`, `/helpdesk/${ticket.id}`);
      }
    });
  }

  if (missing.length > 0) {
    console.log(`[helpdesk-deadline-check] flagged ${missing.length} ticket(s) missing a deadline`);
  }
}

export function startHelpdeskDeadlineCheckJob() {
  cron.schedule("*/15 * * * *", () => {
    checkDeadlineBreaches().catch((err) => console.error("[helpdesk-deadline-check] failed", err));
    checkMissingDeadlines().catch((err) => console.error("[helpdesk-deadline-check] failed", err));
  });
  setTimeout(() => {
    checkDeadlineBreaches().catch((err) => console.error("[helpdesk-deadline-check] failed", err));
    checkMissingDeadlines().catch((err) => console.error("[helpdesk-deadline-check] failed", err));
  }, 7000);
}
