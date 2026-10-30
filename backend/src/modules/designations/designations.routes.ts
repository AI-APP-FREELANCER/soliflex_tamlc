import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { assertValidAdminListName } from "../../lib/department-name";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const activeOnly = req.query.all !== "true";
  const designations = await prisma.designation.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(designations);
});

const createSchema = z.object({ name: z.string().trim() });

router.post("/", requireRole(Role.ADMIN), async (req, res) => {
  const data = createSchema.parse(req.body);
  assertValidAdminListName("Designation", data.name);
  const existing = await prisma.designation.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A designation with this name already exists");
  const designation = await prisma.designation.create({ data: { name: data.name, createdById: req.user!.sub } });
  await recordAudit(prisma, { entityType: "Designation", entityId: designation.id, action: "CREATE", changedById: req.user!.sub, newValue: designation.name });
  res.status(201).json(designation);
});

const updateSchema = z.object({ name: z.string().trim().optional(), active: z.boolean().optional() });

router.patch("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.designation.findUniqueOrThrow({ where: { id: req.params.id } });
  if (data.name && data.name !== before.name) {
    assertValidAdminListName("Designation", data.name);
    const existing = await prisma.designation.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, "A designation with this name already exists");
  }
  const designation = await prisma.designation.update({ where: { id: req.params.id }, data });
  if (data.name && data.name !== before.name) {
    await recordAudit(prisma, { entityType: "Designation", entityId: designation.id, field: "name", oldValue: before.name, newValue: designation.name, action: "UPDATE", changedById: req.user!.sub });
  }
  if (data.active !== undefined && data.active !== before.active) {
    await recordAudit(prisma, { entityType: "Designation", entityId: designation.id, field: "active", oldValue: String(before.active), newValue: String(designation.active), action: "UPDATE", changedById: req.user!.sub });
  }
  res.json(designation);
});

router.delete("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const designation = await prisma.designation.findUniqueOrThrow({ where: { id: req.params.id } });
  const inUse = await prisma.ticket.count({ where: { designationId: req.params.id } });
  if (inUse > 0) {
    throw new ApiError(409, `This designation is used by ${inUse} ticket(s) - deactivate it instead of deleting it`);
  }
  await prisma.designation.delete({ where: { id: req.params.id } });
  await recordAudit(prisma, { entityType: "Designation", entityId: designation.id, action: "DELETE", changedById: req.user!.sub, oldValue: designation.name });
  res.json({ ok: true });
});

export default router;
