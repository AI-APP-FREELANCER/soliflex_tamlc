import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { sanitizeUser } from "../auth/auth.service";
import { Role, Workstream } from "@prisma/client";
import { recordAudit } from "../audit/audit.service";
import { ApiError } from "../../middleware/errors";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    where: req.query.workstream ? { workstream: req.query.workstream as Workstream } : undefined,
  });
  res.json(users.map(sanitizeUser));
});

const createUserSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  workstream: z.nativeEnum(Workstream).optional().nullable(),
  department: z.string().optional(),
  phone: z.string().optional(),
});

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("base64url");
}

router.post("/", requireRole(Role.MANAGER), async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email.toLowerCase() }, { employeeId: data.employeeId }] },
  });
  if (existing) {
    throw new ApiError(409, "A user with this email or employee ID already exists");
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.user.create({
    data: {
      ...data,
      email: data.email.toLowerCase(),
      passwordHash,
      createdById: req.user!.sub,
      mustResetPassword: true,
    },
  });
  await recordAudit(prisma, {
    entityType: "User",
    entityId: user.id,
    action: "CREATE",
    changedById: req.user!.sub,
    newValue: `${user.name} (${user.role})`,
  });
  res.status(201).json({ user: sanitizeUser(user), tempPassword });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  workstream: z.nativeEnum(Workstream).optional().nullable(),
  department: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", requireRole(Role.MANAGER), async (req, res) => {
  const data = updateUserSchema.parse(req.body);
  const before = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  if (before.active !== user.active) {
    await recordAudit(prisma, {
      entityType: "User",
      entityId: user.id,
      field: "active",
      oldValue: String(before.active),
      newValue: String(user.active),
      action: "UPDATE",
      changedById: req.user!.sub,
    });
  }
  res.json(sanitizeUser(user));
});

router.post("/:id/reset-password", requireRole(Role.MANAGER), async (req, res) => {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash, mustResetPassword: true },
  });
  await recordAudit(prisma, {
    entityType: "User",
    entityId: user.id,
    action: "PASSWORD_RESET",
    changedById: req.user!.sub,
  });
  res.json({ ok: true, tempPassword });
});

export default router;
