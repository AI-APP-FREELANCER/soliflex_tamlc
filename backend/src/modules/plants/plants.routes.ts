import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { assertValidPlantName } from "../../lib/plant-name";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth);

// Any signed-in user can list plants (needed to populate the ticket-creation
// dropdown); only Admin can create/edit/delete them.
router.get("/", async (req, res) => {
  const activeOnly = req.query.all !== "true";
  const plants = await prisma.plant.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(plants);
});

const createSchema = z.object({ name: z.string().trim() });

router.post("/", requireRole(Role.ADMIN), async (req, res) => {
  const data = createSchema.parse(req.body);
  assertValidPlantName(data.name);
  const existing = await prisma.plant.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A plant with this name already exists");
  const plant = await prisma.plant.create({ data: { name: data.name, createdById: req.user!.sub } });
  await recordAudit(prisma, { entityType: "Plant", entityId: plant.id, action: "CREATE", changedById: req.user!.sub, newValue: plant.name });
  res.status(201).json(plant);
});

const updateSchema = z.object({ name: z.string().trim().optional(), active: z.boolean().optional() });

router.patch("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.plant.findUniqueOrThrow({ where: { id: req.params.id } });
  if (data.name && data.name !== before.name) {
    assertValidPlantName(data.name);
    const existing = await prisma.plant.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, "A plant with this name already exists");
  }
  const plant = await prisma.plant.update({ where: { id: req.params.id }, data });
  if (data.name && data.name !== before.name) {
    await recordAudit(prisma, { entityType: "Plant", entityId: plant.id, field: "name", oldValue: before.name, newValue: plant.name, action: "UPDATE", changedById: req.user!.sub });
  }
  if (data.active !== undefined && data.active !== before.active) {
    await recordAudit(prisma, { entityType: "Plant", entityId: plant.id, field: "active", oldValue: String(before.active), newValue: String(plant.active), action: "UPDATE", changedById: req.user!.sub });
  }
  res.json(plant);
});

router.delete("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const plant = await prisma.plant.findUniqueOrThrow({ where: { id: req.params.id } });
  const inUse = await prisma.ticket.count({ where: { plantId: req.params.id } });
  if (inUse > 0) {
    throw new ApiError(409, `This plant is used by ${inUse} ticket(s) - deactivate it instead of deleting it`);
  }
  await prisma.plant.delete({ where: { id: req.params.id } });
  await recordAudit(prisma, { entityType: "Plant", entityId: plant.id, action: "DELETE", changedById: req.user!.sub, oldValue: plant.name });
  res.json({ ok: true });
});

export default router;
