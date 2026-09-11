import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { csvUpload } from "../../middleware/upload";
import { sanitizeUser } from "../auth/auth.service";
import { Role, Workstream } from "@prisma/client";
import { recordAudit } from "../audit/audit.service";
import { buildCsv } from "../../lib/csv";
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

async function createUserRecord(data: z.infer<typeof createUserSchema>, createdById: string) {
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
      createdById,
      mustResetPassword: true,
    },
  });
  await recordAudit(prisma, {
    entityType: "User",
    entityId: user.id,
    action: "CREATE",
    changedById: createdById,
    newValue: `${user.name} (${user.role})`,
  });
  return { user, tempPassword };
}

router.post("/", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const { user, tempPassword } = await createUserRecord(data, req.user!.sub);
  res.status(201).json({ user: sanitizeUser(user), tempPassword });
});

const BULK_IMPORT_HEADERS = ["employeeId", "name", "email", "role", "workstream", "department", "phone"];

router.get("/template", requireRole(Role.MANAGER, Role.ADMIN), (_req, res) => {
  const csv = buildCsv(BULK_IMPORT_HEADERS, [
    ["EMP-501", "Jane Doe", "jane.doe@soliflexpackaging.com", "MECHANIC", "MAINTENANCE", "Maintenance", "9876543210"],
  ]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=users-template.csv");
  res.send(csv);
});

router.post("/bulk-import", requireRole(Role.MANAGER, Role.ADMIN), csvUpload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(400, "No CSV file uploaded");

  let records: Record<string, string>[];
  try {
    records = parseCsv(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    throw new ApiError(400, `Could not parse CSV: ${(e as Error).message}`);
  }
  if (records.length === 0) {
    throw new ApiError(400, "CSV has no data rows");
  }
  if (records.length > 500) {
    throw new ApiError(400, "CSV has too many rows (max 500 per upload)");
  }

  const errors: { row: number; message: string }[] = [];
  const created: { name: string; email: string; tempPassword: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2;
    const parsed = createUserSchema.safeParse({
      ...records[i],
      workstream: records[i].workstream || undefined,
      department: records[i].department || undefined,
      phone: records[i].phone || undefined,
    });
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ") });
      continue;
    }
    try {
      const { user, tempPassword } = await createUserRecord(parsed.data, req.user!.sub);
      created.push({ name: user.name, email: user.email, tempPassword });
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof ApiError ? e.message : (e as Error).message });
    }
  }

  res.json({ imported: created.length, failed: errors.length, created, errors });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  workstream: z.nativeEnum(Workstream).optional().nullable(),
  department: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
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

router.post("/:id/reset-password", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
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
