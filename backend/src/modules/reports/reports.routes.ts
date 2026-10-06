import { Router } from "express";
import ExcelJS from "exceljs";
import { Workstream } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { LEGACY_ROLES } from "../../lib/roles";
import { prisma } from "../../lib/prisma";
import { resolveDateRange } from "../../lib/date-range";
import { buildDashboardReport, buildOverdueReport, helpdeskWhere, includesHelpdesk, ticketWhere } from "./reports.service";

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
    { header: "Status", key: "status", width: 18 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Reported By", key: "reportedBy", width: 18 },
    { header: "Assigned To", key: "assignedTo", width: 18 },
    { header: "On Hold", key: "onHold", width: 10 },
    { header: "SLA Breached", key: "slaBreached", width: 12 },
    { header: "Actual Cost", key: "actualCost", width: 12 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Closed At", key: "closedAt", width: 18 },
  ];
  for (const t of ticketList) {
    sheet.addRow({
      ticketNumber: t.ticketNumber,
      workstream: t.workstream,
      category: t.category,
      title: t.title,
      status: t.status,
      priority: t.priority ?? "",
      reportedBy: t.reportedBy?.name ?? "",
      assignedTo: t.assignedTo?.name ?? "",
      onHold: t.onHold ? "Yes" : "No",
      slaBreached: t.slaBreached || (t.status !== "CLOSED" && t.targetCompletionDate !== null && t.targetCompletionDate < new Date()) ? "Yes" : "No",
      actualCost: t.actualCost ?? 0,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? "",
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
    ];
    const now = new Date();
    for (const h of helpdeskList) {
      const finished = h.status === "CLOSED" || h.status === "RESOLVED";
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
      });
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=soliflex-tickets-report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
