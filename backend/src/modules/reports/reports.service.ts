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
  inProgress: number;
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
  title: string | null;
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

// Target-completion-date tracking (and so overdue/SLA breach) only applies to
// IT tickets - the Oct 2026 maintenance redesign dropped it entirely in favour
// of phase-by-phase status analytics (see buildMaintenanceAnalytics below).
function ticketBreachedWhere(now: Date): Prisma.TicketWhereInput {
  return { workstream: Workstream.IT, OR: [{ slaBreached: true }, { status: { not: TicketStatus.CLOSED }, targetCompletionDate: { lt: now } }] };
}

function ticketOverdueWhere(now: Date): Prisma.TicketWhereInput {
  return { workstream: Workstream.IT, status: { not: TicketStatus.CLOSED }, targetCompletionDate: { lt: now } };
}

function ticketOnHoldWhere(): Prisma.TicketWhereInput {
  return { OR: [{ onHold: true }, { status: TicketStatus.ON_HOLD }] };
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
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "ON_HOLD",
  "VERIFICATION_NEEDED",
  "VERIFIED",
  "REJECTED",
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
    tInProgress,
    tBreached,
    tOverdue,
    tClosedRows,
    tCost,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: tWhere, _count: true }),
    prisma.ticket.groupBy({ by: ["priority"], where: tWhere, _count: true }),
    prisma.ticket.count({ where: tWhere }),
    prisma.ticket.count({ where: { ...tWhere, status: TicketStatus.CLOSED } }),
    prisma.ticket.count({ where: { AND: [tWhere, ticketOnHoldWhere()] } }),
    prisma.ticket.count({ where: { ...tWhere, status: TicketStatus.IN_PROGRESS } }),
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
    inProgress: tInProgress,
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
    const [hByStatus, hByPriority, hTotal, hClosed, hOnHold, hInProgress, hBreached, hOverdue, hResolvedRows] = await Promise.all([
      prisma.helpdeskTicket.groupBy({ by: ["status"], where: hWhere, _count: true }),
      prisma.helpdeskTicket.groupBy({ by: ["priority"], where: hWhere, _count: true }),
      prisma.helpdeskTicket.count({ where: hWhere }),
      prisma.helpdeskTicket.count({ where: { ...hWhere, status: HelpdeskStatus.CLOSED } }),
      prisma.helpdeskTicket.count({ where: { ...hWhere, onHold: true } }),
      prisma.helpdeskTicket.count({ where: { ...hWhere, status: HelpdeskStatus.IN_PROGRESS } }),
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
      inProgress: hInProgress,
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
    inProgress: tickets.inProgress + (helpdesk?.inProgress ?? 0),
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

// ======================================================================
// Maintenance-only analytics (Oct 2026 redesign): no overdue/target-date
// tracking any more, replaced by phase-by-phase time-in-status, broken down
// by problem type, plant, department, machine status and delay reason.
// Hours are only counted while a ticket is actually in that status - a
// RUNNING machine's ticket sitting in VERIFICATION_NEEDED still counts as
// "time in verification", it's just not counted as asset downtime.
// ======================================================================

export interface MachineAnalytics {
  machineId: string;
  itemCode: string;
  name: string;
  plantLocation: string | null;
  ticketCount: number;
  avgDowntimeHours: number;
  /** Classic MTBF = window duration / failure count. null = no ticket raised in the window ("no occurrence"). */
  mtbfHours: number | null;
  uptimeHours: number;
  lastFailureAt: string | null;
}

export interface MonthlyTrendPoint {
  month: string; // "yyyy-MM" (UTC calendar month)
  ticketCount: number;
  downtimeHours: number;
}

export interface UnitAvailability {
  plant: string;
  machineCount: number;
  availabilityPct: number;
}

export interface MaintenanceAnalytics {
  ticketCount: number;
  avgHoursByStatus: { status: string; avgHours: number; count: number }[];
  avgTotalResolutionHours: number;
  avgDowntimeHours: number; // only while machineStatus = STOPPED, and only resolved tickets
  // Mean Time To Repair, split by whether the machine was actually stopped.
  mttrStoppedHours: number;
  mttrNotStoppedHours: number;
  byProblemType: { problemType: string; count: number }[];
  byPlant: { plant: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  byMachineStatus: { machineStatus: string; count: number }[];
  byDelayReason: { delayReason: string; count: number }[];
  byMachine: MachineAnalytics[];
  monthlyTrend: MonthlyTrendPoint[];
  unitAvailability: UnitAvailability[];
  checklistCompliance: { field: string; yes: number; no: number; na: number }[];
  qualityRatings: { rating: string; count: number }[];
  rejectedCount: number;
}

export async function buildMaintenanceAnalytics(range: DateRange | undefined, now = new Date()): Promise<MaintenanceAnalytics> {
  const where: Prisma.TicketWhereInput = { workstream: Workstream.MAINTENANCE, ...(range ? { createdAt: range } : {}) };

  const [tickets, byProblemType, byPlant, byDepartment, byMachineStatus, byDelayReason, rejectedCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        closedAt: true,
        status: true,
        machineStatus: true,
        maintenanceAssetId: true,
        qualityRating: true,
        checklistToolsReclaimed: true,
        checklistMachineCleaned: true,
        checklistCableRouting: true,
        statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.ticket.groupBy({ by: ["problemType"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["plantId"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["departmentId"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["machineStatus"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["delayReason"], where, _count: true }),
    prisma.ticket.count({ where: { ...where, statusHistory: { some: { toStatus: TicketStatus.REJECTED } } } }),
  ]);

  const [plants, departments, machines] = await Promise.all([prisma.plant.findMany(), prisma.department.findMany(), prisma.maintenanceAsset.findMany()]);
  const plantName = new Map(plants.map((p) => [p.id, p.name]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  // Time-in-status: for each ticket, walk its history and accumulate the gap
  // between consecutive entries under the status it was leaving.
  const hoursByStatus = new Map<string, { total: number; count: number }>();
  let totalResolutionMs = 0;
  let resolvedCount = 0;
  let totalDowntimeMs = 0;
  let downtimeCount = 0;
  // MTTR split by whether the machine was actually stopped for this ticket.
  let stoppedResolutionMs = 0;
  let stoppedResolutionCount = 0;
  let notStoppedResolutionMs = 0;
  let notStoppedResolutionCount = 0;
  // Per-machine failure stats, keyed by maintenanceAssetId.
  const machineStats = new Map<string, { ticketCount: number; downtimeMs: number; lastFailureAt: Date }>();
  // Ticket count + downtime by UTC calendar month ("yyyy-MM").
  const monthlyStats = new Map<string, { ticketCount: number; downtimeMs: number }>();

  for (const t of tickets) {
    const history = t.statusHistory;
    for (let i = 0; i < history.length; i++) {
      const start = history[i].createdAt;
      const end = i + 1 < history.length ? history[i + 1].createdAt : t.closedAt;
      // A ticket still sitting in this status hasn't actually finished that
      // phase yet - counting elapsed-so-far (vs. "now") would inflate the
      // average every time the report is refreshed, so skip it until the
      // phase actually ends (next transition, or the ticket closes).
      if (!end) continue;
      const ms = Math.max(0, end.getTime() - start.getTime());
      const status = history[i].toStatus;
      const bucket = hoursByStatus.get(status) ?? { total: 0, count: 0 };
      bucket.total += ms;
      bucket.count += 1;
      hoursByStatus.set(status, bucket);
    }

    const monthKey = `${t.createdAt.getUTCFullYear()}-${String(t.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthBucket = monthlyStats.get(monthKey) ?? { ticketCount: 0, downtimeMs: 0 };
    monthBucket.ticketCount += 1;

    if (t.closedAt) {
      const resolutionMs = t.closedAt.getTime() - t.createdAt.getTime();
      totalResolutionMs += resolutionMs;
      resolvedCount++;
      if (t.machineStatus === "STOPPED") {
        totalDowntimeMs += resolutionMs;
        downtimeCount++;
        stoppedResolutionMs += resolutionMs;
        stoppedResolutionCount++;
        monthBucket.downtimeMs += resolutionMs;
      } else {
        notStoppedResolutionMs += resolutionMs;
        notStoppedResolutionCount++;
      }
    }
    monthlyStats.set(monthKey, monthBucket);

    if (t.maintenanceAssetId) {
      const stats = machineStats.get(t.maintenanceAssetId) ?? { ticketCount: 0, downtimeMs: 0, lastFailureAt: t.createdAt };
      stats.ticketCount += 1;
      if (t.createdAt > stats.lastFailureAt) stats.lastFailureAt = t.createdAt;
      // Per-machine downtime feeds unit/machine availability, a live snapshot -
      // a ticket that is still open with the machine stopped has been down from
      // creation until now, not zero just because it hasn't closed yet (unlike
      // avgDowntimeHours/MTTR above, which are historical repair-time metrics
      // and intentionally only count tickets that have actually closed).
      if (t.machineStatus === "STOPPED") {
        const downtimeEnd = t.closedAt ?? now;
        stats.downtimeMs += Math.max(0, downtimeEnd.getTime() - t.createdAt.getTime());
      }
      machineStats.set(t.maintenanceAssetId, stats);
    }
  }

  // MTBF window: the selected date range, falling back to the span actually
  // covered by the data (or the last 30 days if there's nothing to go on).
  const windowStart = range?.gte ?? (tickets.length > 0 ? new Date(Math.min(...tickets.map((t) => t.createdAt.getTime()))) : new Date(now.getTime() - 30 * 86_400_000));
  const windowEnd = range?.lte ?? now;
  const windowHours = Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / 3_600_000);

  const byMachine: MachineAnalytics[] = machines.map((m) => {
    const stats = machineStats.get(m.id);
    const ticketCount = stats?.ticketCount ?? 0;
    const downtimeHours = stats ? Math.round((stats.downtimeMs / 3_600_000) * 10) / 10 : 0;
    return {
      machineId: m.id,
      itemCode: m.itemCode,
      name: m.name,
      plantLocation: m.plantLocation,
      ticketCount,
      avgDowntimeHours: ticketCount > 0 ? Math.round((downtimeHours / ticketCount) * 10) / 10 : 0,
      mtbfHours: ticketCount > 0 ? Math.round((windowHours / ticketCount) * 10) / 10 : null,
      uptimeHours: Math.round(Math.max(0, windowHours - downtimeHours) * 10) / 10,
      lastFailureAt: stats?.lastFailureAt.toISOString() ?? null,
    };
  });

  const unitAvailability: UnitAvailability[] = [...new Set(machines.map((m) => m.plantLocation).filter((p): p is string => !!p))]
    .map((plant) => {
      const plantMachines = byMachine.filter((m) => m.plantLocation === plant);
      const avgAvailability = plantMachines.reduce((sum, m) => sum + Math.max(0, Math.min(100, (m.uptimeHours / windowHours) * 100)), 0) / plantMachines.length;
      return { plant, machineCount: plantMachines.length, availabilityPct: Math.round(avgAvailability * 10) / 10 };
    })
    .sort((a, b) => a.plant.localeCompare(b.plant));

  const monthlyTrend: MonthlyTrendPoint[] = [...monthlyStats.entries()]
    .map(([month, { ticketCount, downtimeMs }]) => ({ month, ticketCount, downtimeHours: Math.round((downtimeMs / 3_600_000) * 10) / 10 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const checklistField = (vals: (string | null)[]) => ({
    yes: vals.filter((v) => v === "YES").length,
    no: vals.filter((v) => v === "NO").length,
    na: vals.filter((v) => v === "NA").length,
  });

  const qualityCounts = new Map<string, number>();
  for (const t of tickets) {
    if (t.qualityRating) qualityCounts.set(t.qualityRating, (qualityCounts.get(t.qualityRating) ?? 0) + 1);
  }

  return {
    ticketCount: tickets.length,
    avgHoursByStatus: [...hoursByStatus.entries()]
      .map(([status, { total, count }]) => ({ status, avgHours: Math.round((total / count / 3_600_000) * 10) / 10, count }))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    avgTotalResolutionHours: resolvedCount > 0 ? Math.round((totalResolutionMs / resolvedCount / 3_600_000) * 10) / 10 : 0,
    avgDowntimeHours: downtimeCount > 0 ? Math.round((totalDowntimeMs / downtimeCount / 3_600_000) * 10) / 10 : 0,
    mttrStoppedHours: stoppedResolutionCount > 0 ? Math.round((stoppedResolutionMs / stoppedResolutionCount / 3_600_000) * 10) / 10 : 0,
    mttrNotStoppedHours: notStoppedResolutionCount > 0 ? Math.round((notStoppedResolutionMs / notStoppedResolutionCount / 3_600_000) * 10) / 10 : 0,
    byProblemType: byProblemType.map((r) => ({ problemType: r.problemType ?? "Not set", count: r._count })),
    byPlant: byPlant.map((r) => ({ plant: r.plantId ? plantName.get(r.plantId) ?? "Unknown" : "Not set", count: r._count })),
    byDepartment: byDepartment.map((r) => ({ department: r.departmentId ? deptName.get(r.departmentId) ?? "Unknown" : "Not set", count: r._count })),
    byMachineStatus: byMachineStatus.map((r) => ({ machineStatus: r.machineStatus ?? "Not set", count: r._count })),
    byDelayReason: byDelayReason.filter((r) => r.delayReason).map((r) => ({ delayReason: r.delayReason!, count: r._count })),
    byMachine: byMachine.sort((a, b) => b.ticketCount - a.ticketCount),
    monthlyTrend,
    unitAvailability,
    checklistCompliance: [
      { field: "Tools reclaimed (5S)", ...checklistField(tickets.map((t) => t.checklistToolsReclaimed)) },
      { field: "Machine cleaned (5S)", ...checklistField(tickets.map((t) => t.checklistMachineCleaned)) },
      { field: "Cable routing (5S)", ...checklistField(tickets.map((t) => t.checklistCableRouting)) },
    ],
    qualityRatings: [...qualityCounts.entries()].map(([rating, count]) => ({ rating, count })),
    rejectedCount,
  };
}

export { ticketWhere, helpdeskWhere };
