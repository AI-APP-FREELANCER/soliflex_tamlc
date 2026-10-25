import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { assertValidDepartmentName } from "../../lib/department-name";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const activeOnly = req.query.all !== "true";
  const departments = await prisma.department.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(departments);
});

const createSchema = z.object({ name: z.string().trim() });

router.post("/", requireRole(Role.ADMIN), async (req, res) => {
  const data = createSchema.parse(req.body);
  assertValidDepartmentName(data.name);
  const existing = await prisma.department.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A department with this name already exists");
  const department = await prisma.department.create({ data: { name: data.name, createdById: req.user!.sub } });
  await recordAudit(prisma, { entityType: "Department", entityId: department.id, action: "CREATE", changedById: req.user!.sub, newValue: department.name });
  res.status(201).json(department);
});

const updateSchema = z.object({ name: z.string().trim().optional(), active: z.boolean().optional() });

router.patch("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.department.findUniqueOrThrow({ where: { id: req.params.id } });
  if (data.name && data.name !== before.name) {
    assertValidDepartmentName(data.name);
    const existing = await prisma.department.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, "A department with this name already exists");
  }
  const department = await prisma.department.update({ where: { id: req.params.id }, data });
  if (data.name && data.name !== before.name) {
    await recordAudit(prisma, { entityType: "Department", entityId: department.id, field: "name", oldValue: before.name, newValue: department.name, action: "UPDATE", changedById: req.user!.sub });
  }
  if (data.active !== undefined && data.active !== before.active) {
    await recordAudit(prisma, { entityType: "Department", entityId: department.id, field: "active", oldValue: String(before.active), newValue: String(department.active), action: "UPDATE", changedById: req.user!.sub });
  }
  res.json(department);
});

router.delete("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const department = await prisma.department.findUniqueOrThrow({ where: { id: req.params.id } });
  const inUse = await prisma.ticket.count({ where: { departmentId: req.params.id } });
  if (inUse > 0) {
    throw new ApiError(409, `This department is used by ${inUse} ticket(s) - deactivate it instead of deleting it`);
  }
  await prisma.department.delete({ where: { id: req.params.id } });
  await recordAudit(prisma, { entityType: "Department", entityId: department.id, action: "DELETE", changedById: req.user!.sub, oldValue: department.name });
  res.json({ ok: true });
});

export default router;
