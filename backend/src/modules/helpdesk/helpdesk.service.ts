import { HelpdeskCategory, HelpdeskStatus, HelpdeskTicket, NotificationType, Prisma, Priority, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { canPerform, HelpdeskAction } from "./workflow";
import { helpdeskVisibilityWhere, assertCanView, HelpdeskActor } from "./helpdesk-permissions";
import { nextSequenceValue, formatHelpdeskTicketNumber } from "../sequences/sequence.service";
import { recordAudit, recordFieldChanges } from "../audit/audit.service";
import { notify } from "../notifications/notifications.service";
import { resolveDateRange, DateRangeQuery } from "../../lib/date-range";

export interface Actor extends HelpdeskActor {
  name: string;
}

const HELPDESK_INCLUDE = {
  raisedBy: { select: { id: true, name: true, role: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  teamLead: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
  statusHistory: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.HelpdeskTicketInclude;

async function findLeadsAndAdmins() {
  return prisma.user.findMany({ where: { role: { in: [Role.IT_TEAM_LEAD, Role.ADMIN] }, active: true } });
}

export interface CreateHelpdeskTicketInput {
  category: HelpdeskCategory;
  title: string;
  description: string;
  itAssetId?: string;
}

export async function createHelpdeskTicket(actor: Actor, input: CreateHelpdeskTicketInput) {
  const ticket = await prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx as typeof prisma, "helpdesk-ticket", 1000);
    const ticketNumber = formatHelpdeskTicketNumber(seq);

    const created = await tx.helpdeskTicket.create({
      data: {
        ticketNumber,
        category: input.category,
        title: input.title,
        description: input.description,
        itAssetId: input.itAssetId,
        raisedById: actor.id,
        status: HelpdeskStatus.OPEN,
      },
    });

    await tx.helpdeskStatusHistory.create({
      data: { ticketId: created.id, toStatus: HelpdeskStatus.OPEN, changedById: actor.id, comment: "Ticket raised" },
    });

    await recordAudit(tx, {
      entityType: "HelpdeskTicket",
      entityId: created.id,
      action: "CREATE",
      changedById: actor.id,
      newValue: ticketNumber,
    });

    const leads = await findLeadsAndAdmins();
    for (const lead of leads) {
      if (lead.id === actor.id) continue;
      await notify(tx, lead.id, NotificationType.HELPDESK_TICKET_CREATED, `New helpdesk ticket ${ticketNumber} raised: ${input.title}`, `/helpdesk/${created.id}`);
    }

    return created;
  });

  return getHelpdeskTicket(ticket.id, actor);
}

export interface HelpdeskFilter extends DateRangeQuery {
  status?: HelpdeskStatus;
  category?: HelpdeskCategory;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
  missingDeadline?: boolean;
}

export async function listHelpdeskTickets(filter: HelpdeskFilter, actor: Actor) {
  const createdAtRange = resolveDateRange(filter);
  return prisma.helpdeskTicket.findMany({
    where: {
      ...helpdeskVisibilityWhere(actor),
      status: filter.status,
      category: filter.category,
      priority: filter.priority,
      assignedToId: filter.assignedToId,
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
      ...(filter.missingDeadline
        ? { status: { in: [HelpdeskStatus.ASSIGNED, HelpdeskStatus.IN_PROGRESS] }, deadline: null }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { ticketNumber: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      raisedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      teamLead: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getHelpdeskTicket(id: string, actor: Actor) {
  const ticket = await prisma.helpdeskTicket.findUnique({ where: { id }, include: HELPDESK_INCLUDE });
  if (!ticket) throw new ApiError(404, "Helpdesk ticket not found");
  assertCanView(actor, ticket);
  return ticket;
}

function assertAction(ticket: HelpdeskTicket, actor: Actor, action: HelpdeskAction) {
  const check = canPerform(action, ticket, actor);
  if (!check.allowed) {
    throw new ApiError(403, check.reason ?? "Action not allowed");
  }
}

function notifyRecipients(tx: Prisma.TransactionClient, ids: (string | null | undefined)[], excludeId: string, type: NotificationType, message: string, link: string) {
  const unique = new Set(ids.filter((id): id is string => Boolean(id) && id !== excludeId));
  return Promise.all(Array.from(unique).map((id) => notify(tx, id, type, message, link)));
}

export async function assignHelpdeskTicket(actor: Actor, ticketId: string, assignedToId: string, deadline: string, priority?: Priority) {
  if (!deadline) {
    throw new ApiError(400, "A deadline must be set when assigning a helpdesk ticket");
  }
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "ASSIGN");

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assignedToId } });
  if (assignee.role !== Role.IT_SUPPORT_ENGINEER && assignee.role !== Role.IT_TEAM_LEAD && assignee.role !== Role.ADMIN) {
    throw new ApiError(400, "Assignee must be an IT Support Engineer, IT Team Lead, or Admin");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId,
        teamLeadId: actor.id,
        priority: priority ?? ticket.priority,
        deadline: new Date(deadline),
        deadlineSetAt: new Date(),
        deadlineBreached: false,
        missingDeadlineAlertedAt: null,
        status: HelpdeskStatus.ASSIGNED,
      },
    });
    await tx.helpdeskStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: HelpdeskStatus.ASSIGNED, changedById: actor.id, comment: `Assigned to ${assignee.name}` },
    });
    await recordFieldChanges(
      tx,
      "HelpdeskTicket",
      ticketId,
      actor.id,
      { status: ticket.status, assignedToId: ticket.assignedToId, deadline: ticket.deadline },
      { status: updated.status, assignedToId: updated.assignedToId, deadline: updated.deadline }
    );
    await notifyRecipients(tx, [assignedToId, ticket.raisedById], actor.id, NotificationType.HELPDESK_TICKET_ASSIGNED, `You were assigned helpdesk ticket ${ticket.ticketNumber}`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function updateDeadline(actor: Actor, ticketId: string, deadline: string) {
  if (actor.role !== Role.IT_TEAM_LEAD && actor.role !== Role.ADMIN) {
    throw new ApiError(403, "Only the IT Team Lead or Admin can update the deadline");
  }
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({
      where: { id: ticketId },
      data: { deadline: new Date(deadline), deadlineSetAt: new Date(), deadlineBreached: false, missingDeadlineAlertedAt: null },
    });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, field: "deadline", oldValue: ticket.deadline?.toISOString() ?? null, newValue: updated.deadline?.toISOString(), action: "UPDATE", changedById: actor.id });
    return updated;
  });
}

export async function startProgress(actor: Actor, ticketId: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "START_PROGRESS");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({ where: { id: ticketId }, data: { status: HelpdeskStatus.IN_PROGRESS } });
    await tx.helpdeskStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: HelpdeskStatus.IN_PROGRESS, changedById: actor.id } });
    await notifyRecipients(tx, [ticket.raisedById, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_STATUS_CHANGED, `${actor.name} started work on ${ticket.ticketNumber}`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function holdTicket(actor: Actor, ticketId: string, detail: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "HOLD");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({ where: { id: ticketId }, data: { onHold: true, onHoldReason: detail, onHoldSince: new Date() } });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, action: "HOLD", changedById: actor.id, newValue: detail });
    await notifyRecipients(tx, [ticket.raisedById, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_STATUS_CHANGED, `${ticket.ticketNumber} put on hold`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function resumeTicket(actor: Actor, ticketId: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "RESUME");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({ where: { id: ticketId }, data: { onHold: false, onHoldReason: null, onHoldSince: null } });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, action: "RESUME", changedById: actor.id });
    await notifyRecipients(tx, [ticket.raisedById, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_STATUS_CHANGED, `${ticket.ticketNumber} resumed`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function resolveTicket(actor: Actor, ticketId: string, resolutionComment?: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "RESOLVE");
  return prisma.$transaction(async (tx) => {
    if (resolutionComment) {
      await tx.helpdeskComment.create({ data: { ticketId, authorId: actor.id, body: resolutionComment } });
    }
    const updated = await tx.helpdeskTicket.update({
      where: { id: ticketId },
      data: { status: HelpdeskStatus.RESOLVED, resolvedById: actor.id, resolvedAt: new Date() },
    });
    await tx.helpdeskStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: HelpdeskStatus.RESOLVED, changedById: actor.id, comment: "Marked resolved" } });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, action: "RESOLVE", changedById: actor.id });
    await notifyRecipients(tx, [ticket.raisedById], actor.id, NotificationType.HELPDESK_TICKET_RESOLVED, `Your helpdesk ticket ${ticket.ticketNumber} was resolved`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function reopenTicket(actor: Actor, ticketId: string, reason: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "REOPEN");
  return prisma.$transaction(async (tx) => {
    await tx.helpdeskComment.create({ data: { ticketId, authorId: actor.id, body: reason } });
    const updated = await tx.helpdeskTicket.update({
      where: { id: ticketId },
      data: { status: HelpdeskStatus.REOPENED, resolvedAt: null, resolvedById: null, closedAt: null, closedById: null },
    });
    await tx.helpdeskStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: HelpdeskStatus.REOPENED, changedById: actor.id, comment: reason } });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, action: "REOPEN", changedById: actor.id, newValue: reason });
    await notifyRecipients(tx, [ticket.assignedToId, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_STATUS_CHANGED, `${ticket.ticketNumber} was reopened`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function closeTicket(actor: Actor, ticketId: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "CLOSE");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.helpdeskTicket.update({ where: { id: ticketId }, data: { status: HelpdeskStatus.CLOSED, closedById: actor.id, closedAt: new Date() } });
    await tx.helpdeskStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: HelpdeskStatus.CLOSED, changedById: actor.id, comment: "Closed" } });
    await recordAudit(tx, { entityType: "HelpdeskTicket", entityId: ticketId, action: "CLOSE", changedById: actor.id });
    await notifyRecipients(tx, [ticket.raisedById, ticket.assignedToId, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_TICKET_CLOSED, `${ticket.ticketNumber} was closed`, `/helpdesk/${ticketId}`);
    return updated;
  });
}

export async function addComment(actor: Actor, ticketId: string, body: string) {
  const ticket = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: ticketId } });
  assertCanView(actor, ticket);
  const comment = await prisma.helpdeskComment.create({ data: { ticketId, authorId: actor.id, body } });
  await notifyRecipients(prisma, [ticket.raisedById, ticket.assignedToId, ticket.teamLeadId], actor.id, NotificationType.HELPDESK_COMMENT_ADDED, `New comment on ${ticket.ticketNumber}`, `/helpdesk/${ticketId}`);
  return comment;
}

export interface HelpdeskDashboardStats {
  byStatus: { status: HelpdeskStatus; count: number }[];
  total: number;
  overdueCount: number;
  missingDeadlineCount: number;
  perEngineerWorkload: { engineerId: string; name: string; open: number; inProgress: number; overdue: number }[];
}

export async function getHelpdeskDashboardStats(filter: DateRangeQuery): Promise<HelpdeskDashboardStats> {
  const createdAtRange = resolveDateRange(filter);
  const where = createdAtRange ? { createdAt: createdAtRange } : {};

  const [byStatus, total, overdueCount, missingDeadlineCount, engineers] = await Promise.all([
    prisma.helpdeskTicket.groupBy({ by: ["status"], where, _count: true }),
    prisma.helpdeskTicket.count({ where }),
    prisma.helpdeskTicket.count({ where: { ...where, deadline: { lt: new Date() }, status: { notIn: [HelpdeskStatus.CLOSED, HelpdeskStatus.RESOLVED] } } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: { in: [HelpdeskStatus.ASSIGNED, HelpdeskStatus.IN_PROGRESS] }, deadline: null } }),
    prisma.user.findMany({ where: { role: Role.IT_SUPPORT_ENGINEER, active: true } }),
  ]);

  const perEngineerWorkload = await Promise.all(
    engineers.map(async (engineer) => {
      const [open, inProgress, overdue] = await Promise.all([
        prisma.helpdeskTicket.count({ where: { ...where, assignedToId: engineer.id, status: HelpdeskStatus.ASSIGNED } }),
        prisma.helpdeskTicket.count({ where: { ...where, assignedToId: engineer.id, status: HelpdeskStatus.IN_PROGRESS } }),
        prisma.helpdeskTicket.count({ where: { ...where, assignedToId: engineer.id, deadline: { lt: new Date() }, status: { notIn: [HelpdeskStatus.CLOSED, HelpdeskStatus.RESOLVED] } } }),
      ]);
      return { engineerId: engineer.id, name: engineer.name, open, inProgress, overdue };
    })
  );

  return {
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    total,
    overdueCount,
    missingDeadlineCount,
    perEngineerWorkload,
  };
}
