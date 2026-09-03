import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router();
router.use(requireAuth, requireRole(Role.MANAGER, Role.ADMIN));

router.get("/", async (req, res) => {
  const take = Math.min(Number(req.query.limit ?? 50), 200);
  const cursor = req.query.cursor as string | undefined;

  const entries = await prisma.auditLog.findMany({
    where: {
      entityType: req.query.entityType ? String(req.query.entityType) : undefined,
      entityId: req.query.entityId ? String(req.query.entityId) : undefined,
    },
    include: { changedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { changedAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > take;
  const page = hasMore ? entries.slice(0, take) : entries;

  res.json({ entries: page, nextCursor: hasMore ? page[page.length - 1].id : null });
});

router.get("/entity-types", async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } });
  res.json(rows.map((r) => r.entityType).sort());
});

export default router;
