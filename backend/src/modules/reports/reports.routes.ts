import { Router } from "express";
import ExcelJS from "exceljs";
import { TicketStatus, Workstream } from "@prisma/client";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", async (req, res) => {
  const workstream = req.query.workstream as Workstream | undefined;
  const where = workstream ? { workstream } : {};

  const [byStatus, byPriority, total, open, closedTickets, slaBreached, onHold] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["priority"], where, _count: true }),
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: { not: TicketStatus.CLOSED } } }),
    prisma.ticket.findMany({ where: { ...where, status: TicketStatus.CLOSED, closedAt: { not: null } }, select: { createdAt: true, closedAt: true } }),
    prisma.ticket.count({ where: { ...where, slaBreached: true } }),
    prisma.ticket.count({ where: { ...where, onHold: true } }),
  ]);

  const avgResolutionHours =
    closedTickets.length > 0
      ? closedTickets.reduce((sum, t) => sum + (t.closedAt!.getTime() - t.createdAt.getTime()), 0) / closedTickets.length / 3_600_000
      : 0;

  const totalCost = await prisma.ticket.aggregate({ where, _sum: { actualCost: true } });

  res.json({
    total,
    open,
    closed: closedTickets.length,
    onHold,
    slaBreached,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    totalCost: totalCost._sum.actualCost ?? 0,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
  });
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
  const workstream = req.query.workstream as Workstream | undefined;
  const ticketList = await prisma.ticket.findMany({
    where: workstream ? { workstream } : {},
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
      slaBreached: t.slaBreached ? "Yes" : "No",
      actualCost: t.actualCost ?? 0,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? "",
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=soliflex-tickets-report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
