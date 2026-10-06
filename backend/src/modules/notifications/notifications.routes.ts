import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

router.post("/:id/read", async (req, res) => {
  // updateMany scoped to the caller so nobody can touch (or probe) someone else's notification.
  const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.sub }, data: { read: true } });
  if (result.count === 0) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.sub, read: false }, data: { read: true } });
  res.json({ ok: true });
});

export default router;
