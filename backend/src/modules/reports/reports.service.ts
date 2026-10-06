import { HelpdeskStatus, Prisma, Priority, TicketStatus, Workstream } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { DateRange } from "../../lib/date-range";

/**
 * Reports are computed live at request time. Breach/overdue is derived from
 * the deadline vs. "now" (not only from the cron-maintained flag, which can
 * lag by up to 15 minutes), and the IT workstream combines legacy IT tickets
 * with Helpdesk tickets so the numbers match what users see on every screen.
 *
 * All date-range filters apply to the ticket's created date, for every figure
 * on the page, so the cards, charts and lists always agree with each other.
 */

const HELPDESK_FINISHED: HelpdeskStatus[] = [HelpdeskStatus.CLOSED, HelpdeskStatus.RESOLVED];

export type ReportSource = "TICKET" | "HELPDESK";

export interface SourceStats {
  total: number;
  open: number;
  closed: number;
  onHold: number;
  slaBreached: number;
  overdue: number;
}

export interface DashboardReport extends SourceStats {
  avgResolutionHours: number;
  totalCost: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: Priority | null; count: number }[];
  sources: { tickets: SourceStats; helpdesk: SourceStats | null };
}

export interface OverdueItem {
  id: string;
  source: ReportSource;
  ticketNumber: string;
  title: string;
  status: string;
  priority: Priority | null;
  targetCompletionDate: Date;
  assignedTo: { name: string } | null;
}

export function includesHelpdesk(workstream: Workstream | undefined): boolean {
  return workstream === undefined || workstream === Workstream.IT;
}

function ticketWhere(workstream: Workstream | undefined, range: DateRange | undefined): Prisma.TicketWhereInput {
  return { ...(workstream ? { workstream } : {}), ...(range ? { createdAt: range } : {}) };
}

function helpdeskWhere(range: DateRange | undefined): Prisma.HelpdeskTicketWhereInput {
  return range ? { createdAt: range } : {};
}

function ticketBreachedWhere(now: Date): Prisma.TicketWhereInput {
  return { OR: [{ slaBreached: true }, { status: { not: TicketStatus.CLOSED }, targetCompletionDate: { lt: now } }] };
}

function ticketOverdueWhere(now: Date): Prisma.TicketWhereInput {
  return { status: { not: TicketStatus.CLOSED }, targetCompletionDate: { lt: now } };
}

function helpdeskBreachedWhere(now: Date): Prisma.HelpdeskTicketWhereInput {
  return { OR: [{ deadlineBreached: true }, { status: { notIn: HELPDESK_FINISHED }, deadline: { lt: now } }] };
}

function helpdeskOverdueWhere(now: Date): Prisma.HelpdeskTicketWhereInput {
  return { status: { notIn: HELPDESK_FINISHED }, deadline: { lt: now } };
}

const STATUS_ORDER = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "FIRST_LINE_REVIEW",
  "JOB_COMPLETED",
  "FINAL_REVIEW",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
];

export async function buildDashboardReport(workstream: Workstream | undefined, range: DateRange | undefined, now = new Date()): Promise<DashboardReport> {
  const tWhere = ticketWhere(workstream, range);
  const withHelpdesk = includesHelpdesk(workstream);
  const hWhere = helpdeskWhere(range);

  const [
    tByStatus,
    tByPriority,
    tTotal,
    tClosed,
    tOnHold,
    tBreached,
    tOverdue,
    tClosedRows,
    tCost,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: tWhere, _count: true }),
    prisma.ticket.groupBy({ by: ["priority"], where: tWhere, _count: true }),
    prisma.ticket.count({ where: tWhere }),
    prisma.ticket.count({ where: { ...tWhere, status: TicketStatus.CLOSED } }),
    prisma.ticket.count({ where: { ...tWhere, onHold: true } }),
    prisma.ticket.count({ where: { AND: [tWhere, ticketBreachedWhere(now)] } }),
    prisma.ticket.count({ where: { AND: [tWhere, ticketOverdueWhere(now)] } }),
    prisma.ticket.findMany({ where: { ...tWhere, status: TicketStatus.CLOSED, closedAt: { not: null } }, select: { createdAt: true, closedAt: true } }),
    prisma.ticket.aggregate({ where: tWhere, _sum: { actualCost: true } }),
  ]);

  const tickets: SourceStats = {
    total: tTotal,
    open: tTotal - tClosed,
    closed: tClosed,
    onHold: tOnHold,
    slaBreached: tBreached,
    overdue: tOverdue,
  };

  const durationsMs: number[] = tClosedRows.map((t) => t.closedAt!.getTime() - t.createdAt.getTime());
  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<Priority | null, number>();
  for (const s of tByStatus) statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + s._count);
  for (const p of tByPriority) priorityCounts.set(p.priority, (priorityCounts.get(p.priority) ?? 0) + p._count);

  let helpdesk: SourceStats | null = null;
  if (withHelpdesk) {
    const [hByStatus, hByPriority, hTotal, hClosed, hOnHold, hBreached, hOverdue, hResolvedRows] = await Promise.all([
      prisma.helpdeskTicket.groupBy({ by: ["status"], where: hWhere, _count: true }),
      prisma.helpdeskTicket.groupBy({ by: ["priority"], where: hWhere, _count: true }),
      prisma.helpdeskTicket.count({ where: hWhere }),
      prisma.helpdeskTicket.count({ where: { ...hWhere, status: HelpdeskStatus.CLOSED } }),
      prisma.helpdeskTicket.count({ where: { ...hWhere, onHold: true } }),
      prisma.helpdeskTicket.count({ where: { AND: [hWhere, helpdeskBreachedWhere(now)] } }),
      prisma.helpdeskTicket.count({ where: { AND: [hWhere, helpdeskOverdueWhere(now)] } }),
      prisma.helpdeskTicket.findMany({
        where: { ...hWhere, status: { in: HELPDESK_FINISHED } },
        select: { createdAt: true, resolvedAt: true, closedAt: true },
      }),
    ]);

    helpdesk = {
      total: hTotal,
      open: hTotal - hClosed,
      closed: hClosed,
      onHold: hOnHold,
      slaBreached: hBreached,
      overdue: hOverdue,
    };

    for (const s of hByStatus) statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + s._count);
    for (const p of hByPriority) priorityCounts.set(p.priority, (priorityCounts.get(p.priority) ?? 0) + p._count);
    for (const r of hResolvedRows) {
      const finishedAt = r.resolvedAt ?? r.closedAt;
      if (finishedAt) durationsMs.push(finishedAt.getTime() - r.createdAt.getTime());
    }
  }

  const combined: SourceStats = {
    total: tickets.total + (helpdesk?.total ?? 0),
    open: tickets.open + (helpdesk?.open ?? 0),
    closed: tickets.closed + (helpdesk?.closed ?? 0),
    onHold: tickets.onHold + (helpdesk?.onHold ?? 0),
    slaBreached: tickets.slaBreached + (helpdesk?.slaBreached ?? 0),
    overdue: tickets.overdue + (helpdesk?.overdue ?? 0),
  };

  const avgResolutionHours = durationsMs.length > 0 ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 3_600_000 : 0;

  const byStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return {
    ...combined,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    totalCost: tCost._sum.actualCost ?? 0,
    byStatus,
    byPriority: [...priorityCounts.entries()].map(([priority, count]) => ({ priority, count })),
    sources: { tickets, helpdesk },
  };
}

export async function buildOverdueReport(workstream: Workstream | undefined, range: DateRange | undefined, now = new Date()): Promise<OverdueItem[]> {
  const tickets = await prisma.ticket.findMany({
    where: { AND: [ticketWhere(workstream, range), ticketOverdueWhere(now)] },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      targetCompletionDate: true,
      assignedTo: { select: { name: true } },
    },
  });

  const items: OverdueItem[] = tickets.map((t) => ({
    id: t.id,
    source: "TICKET",
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    targetCompletionDate: t.targetCompletionDate!,
    assignedTo: t.assignedTo,
  }));

  if (includesHelpdesk(workstream)) {
    const helpdesk = await prisma.helpdeskTicket.findMany({
      where: { AND: [helpdeskWhere(range), helpdeskOverdueWhere(now)] },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        deadline: true,
        assignedTo: { select: { name: true } },
      },
    });
    for (const h of helpdesk) {
      items.push({
        id: h.id,
        source: "HELPDESK",
        ticketNumber: h.ticketNumber,
        title: h.title,
        status: h.status,
        priority: h.priority,
        targetCompletionDate: h.deadline!,
        assignedTo: h.assignedTo,
      });
    }
  }

  return items.sort((a, b) => a.targetCompletionDate.getTime() - b.targetCompletionDate.getTime());
}

export { ticketWhere, helpdeskWhere };
