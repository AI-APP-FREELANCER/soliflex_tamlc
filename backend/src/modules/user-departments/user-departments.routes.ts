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
  const userDepartments = await prisma.userDepartment.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(userDepartments);
});

const createSchema = z.object({ name: z.string().trim() });

router.post("/", requireRole(Role.ADMIN), async (req, res) => {
  const data = createSchema.parse(req.body);
  assertValidAdminListName("Department", data.name);
  const existing = await prisma.userDepartment.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A department with this name already exists");
  const userDepartment = await prisma.userDepartment.create({ data: { name: data.name, createdById: req.user!.sub } });
  await recordAudit(prisma, { entityType: "UserDepartment", entityId: userDepartment.id, action: "CREATE", changedById: req.user!.sub, newValue: userDepartment.name });
  res.status(201).json(userDepartment);
});

const updateSchema = z.object({ name: z.string().trim().optional(), active: z.boolean().optional() });

router.patch("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.userDepartment.findUniqueOrThrow({ where: { id: req.params.id } });
  if (data.name && data.name !== before.name) {
    assertValidAdminListName("Department", data.name);
    const existing = await prisma.userDepartment.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, "A department with this name already exists");
  }
  const userDepartment = await prisma.userDepartment.update({ where: { id: req.params.id }, data });
  if (data.name && data.name !== before.name) {
    // User.department is a free-text match against this list's name, not an id FK -
    // keep existing user records pointed at the old name in sync with the rename.
    await prisma.user.updateMany({ where: { department: before.name }, data: { department: data.name } });
    await recordAudit(prisma, {
      entityType: "UserDepartment",
      entityId: userDepartment.id,
      field: "name",
      oldValue: before.name,
      newValue: userDepartment.name,
      action: "UPDATE",
      changedById: req.user!.sub,
    });
  }
  if (data.active !== undefined && data.active !== before.active) {
    await recordAudit(prisma, {
      entityType: "UserDepartment",
      entityId: userDepartment.id,
      field: "active",
      oldValue: String(before.active),
      newValue: String(userDepartment.active),
      action: "UPDATE",
      changedById: req.user!.sub,
    });
  }
  res.json(userDepartment);
});

router.delete("/:id", requireRole(Role.ADMIN), async (req, res) => {
  const userDepartment = await prisma.userDepartment.findUniqueOrThrow({ where: { id: req.params.id } });
  const inUse = await prisma.user.count({ where: { department: userDepartment.name } });
  if (inUse > 0) {
    throw new ApiError(409, `This department is used by ${inUse} user(s) - deactivate it instead of deleting it`);
  }
  await prisma.userDepartment.delete({ where: { id: req.params.id } });
  await recordAudit(prisma, { entityType: "UserDepartment", entityId: userDepartment.id, action: "DELETE", changedById: req.user!.sub, oldValue: userDepartment.name });
  res.json({ ok: true });
});

export default router;
