import { Router } from "express";
import ExcelJS from "exceljs";
import { Workstream } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { LEGACY_ROLES } from "../../lib/roles";
import { prisma } from "../../lib/prisma";
import { resolveDateRange } from "../../lib/date-range";
import { buildDashboardReport, buildMaintenanceAnalytics, buildOverdueReport, helpdeskWhere, includesHelpdesk, ticketWhere } from "./reports.service";
import { formatHoursAsClock, formatMsAsClock } from "../../lib/format-duration";

const router = Router();
router.use(requireAuth, requireRole(...LEGACY_ROLES));

function dateRangeFromQuery(req: import("express").Request) {
  return resolveDateRange({
    range: req.query.range as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
}

function workstreamFromQuery(req: import("express").Request): Workstream | undefined {
  const raw = req.query.workstream;
  return raw === Workstream.MAINTENANCE || raw === Workstream.IT ? raw : undefined;
}

router.get("/dashboard", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await buildDashboardReport(workstreamFromQuery(req), dateRangeFromQuery(req)));
});

router.get("/overdue-tickets", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await buildOverdueReport(workstreamFromQuery(req), dateRangeFromQuery(req)));
});

// Maintenance no longer tracks overdue/target dates (Oct 2026 redesign) - instead
// this returns phase-by-phase time analytics and breakdowns for that workstream.
router.get("/maintenance-analytics", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await buildMaintenanceAnalytics(dateRangeFromQuery(req)));
});

router.get("/expiring-assets", async (req, res) => {
  const days = Number(req.query.days ?? 60);
  const cutoff = new Date(Date.now() + days * 86_400_000);
  const now = new Date();
  const [maintenance, it] = await Promise.all([
    prisma.maintenanceAsset.findMany({ where: { warrantyEndDate: { lte: cutoff, gte: now } } }),
    prisma.iTAsset.findMany({ where: { OR: [{ warrantyEndDate: { lte: cutoff, gte: now } }, { licenseExpiryDate: { lte: cutoff, gte: now } }] } }),
  ]);
  res.json({ maintenance, it });
});

router.get("/downtime", async (req, res) => {
  const assets = await prisma.maintenanceAsset.findMany({ where: { status: "DOWN" } });
  res.json(assets);
});

router.get("/export", async (req, res) => {
  const workstream = workstreamFromQuery(req);
  const range = dateRangeFromQuery(req);
  const ticketList = await prisma.ticket.findMany({
    where: ticketWhere(workstream, range),
    include: {
      reportedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      plant: true,
      department: true,
      // First ACKNOWLEDGED entry = time to first response (create -> accepted).
      statusHistory: { where: { toStatus: "ACKNOWLEDGED" }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tickets");
  sheet.columns = [
    { header: "Ticket #", key: "ticketNumber", width: 14 },
    { header: "Workstream", key: "workstream", width: 12 },
    { header: "Category", key: "category", width: 18 },
    { header: "Title", key: "title", width: 30 },
    { header: "Plant", key: "plant", width: 14 },
    { header: "Department", key: "department", width: 16 },
    { header: "Problem Type", key: "problemType", width: 14 },
    { header: "Machine Status", key: "machineStatus", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Reported By", key: "reportedBy", width: 18 },
    { header: "Assigned To", key: "assignedTo", width: 18 },
    { header: "On Hold", key: "onHold", width: 10 },
    { header: "SLA Breached (IT only)", key: "slaBreached", width: 16 },
    { header: "Actual Cost", key: "actualCost", width: 12 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Closed At", key: "closedAt", width: 18 },
    { header: "Time to First Response (hh:mm:ss)", key: "firstResponse", width: 20 },
    { header: "Downtime (hh:mm:ss)", key: "downtime", width: 16 },
  ];
  for (const t of ticketList) {
    const firstAck = t.statusHistory[0]?.createdAt;
    // Downtime only means something for a Maintenance ticket where the machine
    // was actually stopped - a ticket on a running machine has no downtime to
    // report, and IT tickets have no machine/stop concept at all.
    const isDowntimeEligible = t.workstream === "MAINTENANCE" && t.machineStatus === "STOPPED" && t.closedAt;
    sheet.addRow({
      ticketNumber: t.ticketNumber,
      workstream: t.workstream,
      category: t.category,
      title: t.title ?? "",
      plant: t.plant?.name ?? "",
      department: t.department?.name ?? "",
      problemType: t.problemType ?? "",
      machineStatus: t.machineStatus ?? "",
      status: t.status,
      priority: t.priority ?? "",
      reportedBy: t.reportedBy?.name ?? "",
      assignedTo: t.assignedTo?.name ?? "",
      onHold: t.onHold || t.status === "ON_HOLD" ? "Yes" : "No",
      slaBreached: t.workstream === "IT" && (t.slaBreached || (t.status !== "CLOSED" && t.targetCompletionDate !== null && t.targetCompletionDate < new Date())) ? "Yes" : "No",
      actualCost: t.actualCost ?? 0,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? "",
      firstResponse: firstAck ? formatMsAsClock(firstAck.getTime() - t.createdAt.getTime()) : "",
      downtime: isDowntimeEligible ? formatMsAsClock(t.closedAt!.getTime() - t.createdAt.getTime()) : "",
    });
  }

  if (includesHelpdesk(workstream)) {
    const helpdeskList = await prisma.helpdeskTicket.findMany({
      where: helpdeskWhere(range),
      include: {
        raisedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const hSheet = workbook.addWorksheet("Helpdesk Tickets");
    hSheet.columns = [
      { header: "Ticket #", key: "ticketNumber", width: 14 },
      { header: "Category", key: "category", width: 18 },
      { header: "Title", key: "title", width: 30 },
      { header: "Status", key: "status", width: 14 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Raised By", key: "raisedBy", width: 18 },
      { header: "Assigned To", key: "assignedTo", width: 18 },
      { header: "Deadline", key: "deadline", width: 20 },
      { header: "Deadline Breached", key: "breached", width: 16 },
      { header: "On Hold", key: "onHold", width: 10 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Resolved At", key: "resolvedAt", width: 20 },
      { header: "Closed At", key: "closedAt", width: 20 },
      { header: "Resolution Time (hh:mm:ss)", key: "resolutionTime", width: 20 },
    ];
    const now = new Date();
    for (const h of helpdeskList) {
      const finished = h.status === "CLOSED" || h.status === "RESOLVED";
      const finishedAt = h.closedAt ?? h.resolvedAt;
      hSheet.addRow({
        ticketNumber: h.ticketNumber,
        category: h.category,
        title: h.title,
        status: h.status,
        priority: h.priority ?? "",
        raisedBy: h.raisedBy?.name ?? "",
        assignedTo: h.assignedTo?.name ?? "",
        deadline: h.deadline?.toISOString() ?? "",
        breached: h.deadlineBreached || (!finished && h.deadline !== null && h.deadline < now) ? "Yes" : "No",
        onHold: h.onHold ? "Yes" : "No",
        createdAt: h.createdAt.toISOString(),
        resolvedAt: h.resolvedAt?.toISOString() ?? "",
        closedAt: h.closedAt?.toISOString() ?? "",
        resolutionTime: finishedAt ? formatMsAsClock(finishedAt.getTime() - h.createdAt.getTime()) : "",
      });
    }
  }

  if (workstream === "MAINTENANCE") {
    const analytics = await buildMaintenanceAnalytics(range);

    const summarySheet = workbook.addWorksheet("Maintenance Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 32 },
      { header: "Value", key: "value", width: 20 },
    ];
    summarySheet.addRows([
      { metric: "Total tickets", value: analytics.ticketCount },
      { metric: "Avg resolution (all)", value: formatHoursAsClock(analytics.avgTotalResolutionHours) },
      { metric: "Avg downtime (machine stopped)", value: formatHoursAsClock(analytics.avgDowntimeHours) },
      { metric: "MTTR - machine stopped", value: formatHoursAsClock(analytics.mttrStoppedHours) },
      { metric: "MTTR - machine not stopped", value: formatHoursAsClock(analytics.mttrNotStoppedHours) },
      { metric: "Rejected (sent back) count", value: analytics.rejectedCount },
    ]);

    const plantSheet = workbook.addWorksheet("By Plant");
    plantSheet.columns = [
      { header: "Plant", key: "plant", width: 20 },
      { header: "Ticket Count", key: "count", width: 14 },
    ];
    plantSheet.addRows(analytics.byPlant);

    const categorySheet = workbook.addWorksheet("By Product Category");
    categorySheet.columns = [
      { header: "Product Category", key: "department", width: 22 },
      { header: "Ticket Count", key: "count", width: 14 },
    ];
    categorySheet.addRows(analytics.byDepartment);

    const machineSheet = workbook.addWorksheet("By Machine (MTBF)");
    machineSheet.columns = [
      { header: "Item Code", key: "itemCode", width: 14 },
      { header: "Machine", key: "name", width: 26 },
      { header: "Plant", key: "plantLocation", width: 16 },
      { header: "Ticket Count", key: "ticketCount", width: 14 },
      { header: "Avg Downtime (hh:mm:ss)", key: "avgDowntime", width: 20 },
      { header: "Uptime in window (hh:mm:ss)", key: "uptime", width: 22 },
      { header: "MTBF (hh:mm:ss)", key: "mtbf", width: 18 },
      { header: "Last Failure", key: "lastFailureAt", width: 20 },
    ];
    for (const m of analytics.byMachine) {
      machineSheet.addRow({
        itemCode: m.itemCode,
        name: m.name,
        plantLocation: m.plantLocation ?? "",
        ticketCount: m.ticketCount,
        avgDowntime: formatHoursAsClock(m.avgDowntimeHours),
        uptime: formatHoursAsClock(m.uptimeHours),
        mtbf: m.mtbfHours !== null ? formatHoursAsClock(m.mtbfHours) : "No occurrence",
        lastFailureAt: m.lastFailureAt ?? "",
      });
    }

    const trendSheet = workbook.addWorksheet("Monthly Trend");
    trendSheet.columns = [
      { header: "Month", key: "month", width: 12 },
      { header: "Ticket Count", key: "ticketCount", width: 14 },
      { header: "Downtime (hh:mm:ss)", key: "downtime", width: 18 },
    ];
    for (const p of analytics.monthlyTrend) {
      trendSheet.addRow({ month: p.month, ticketCount: p.ticketCount, downtime: formatHoursAsClock(p.downtimeHours) });
    }

    const availabilitySheet = workbook.addWorksheet("Unit Availability");
    availabilitySheet.columns = [
      { header: "Plant (Unit)", key: "plant", width: 16 },
      { header: "Machine Count", key: "machineCount", width: 14 },
      { header: "Availability %", key: "availabilityPct", width: 16 },
    ];
    availabilitySheet.addRows(analytics.unitAvailability);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=soliflex-tickets-report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
