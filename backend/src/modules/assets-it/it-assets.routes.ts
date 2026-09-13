import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { parse as parseCsv } from "csv-parse/sync";
import { AssetStatus, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { upload, csvUpload } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { nextSequenceValue, formatAssetItemCode } from "../sequences/sequence.service";
import { recordAudit } from "../audit/audit.service";
import { publicUrlForFile } from "../../lib/storage";
import { buildCsv } from "../../lib/csv";
import { env } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { parseFlexibleDate } from "../../lib/parse-date";
import { normalizeCategory } from "../../lib/normalize-category";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const assets = await prisma.iTAsset.findMany({
    where: {
      category: req.query.category ? normalizeCategory(String(req.query.category)) : undefined,
      status: req.query.status as AssetStatus | undefined,
      OR: req.query.search
        ? [
            { name: { contains: String(req.query.search), mode: "insensitive" } },
            { itemCode: { contains: String(req.query.search), mode: "insensitive" } },
            { serialNumber: { contains: String(req.query.search), mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { invoices: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(assets);
});

router.get("/categories", async (_req, res) => {
  const rows = await prisma.iTAsset.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  res.json(rows.map((r) => r.category));
});

const BULK_IMPORT_HEADERS = [
  "name",
  "category",
  "serialNumber",
  "specifications",
  "ipAddress",
  "macAddress",
  "vendor",
  "purchaseDate",
  "warrantyEndDate",
  "licenseExpiryDate",
  "costCenter",
];

router.get("/template", requireRole(Role.IT_TEAM, Role.MANAGER, Role.ADMIN), (_req, res) => {
  const csv = buildCsv(BULK_IMPORT_HEADERS, [
    [
      "Server Rack 2 - App Server",
      "SERVER",
      "SN-APP-0092",
      "2U rack server, 128GB RAM",
      "10.10.1.21",
      "AA:BB:CC:DD:EE:FF",
      "Dell",
      "2024-01-15",
      "2027-01-15",
      "",
      "CC-IT-01",
    ],
  ]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=it-assets-template.csv");
  res.send(csv);
});

router.get("/expiring", async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const cutoff = new Date(Date.now() + days * 86_400_000);
  const assets = await prisma.iTAsset.findMany({
    where: {
      OR: [
        { warrantyEndDate: { lte: cutoff, gte: new Date() } },
        { licenseExpiryDate: { lte: cutoff, gte: new Date() } },
      ],
    },
    orderBy: { warrantyEndDate: "asc" },
  });
  res.json(assets);
});

router.get("/:id", async (req, res) => {
  const asset = await prisma.iTAsset.findUnique({ where: { id: req.params.id }, include: { invoices: true } });
  if (!asset) throw new ApiError(404, "Asset not found");
  res.json(asset);
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1).transform(normalizeCategory),
  serialNumber: z.string().optional(),
  specifications: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  vendor: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  licenseExpiryDate: z.string().optional(),
  costCenter: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

async function createITAssetRecord(data: z.infer<typeof createSchema>, createdById: string) {
  const asset = await prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx as typeof prisma, "asset:IT", 0);
    const itemCode = formatAssetItemCode("IT", seq);
    const created = await tx.iTAsset.create({
      data: {
        itemCode,
        name: data.name,
        category: data.category,
        serialNumber: data.serialNumber,
        specifications: data.specifications,
        ipAddress: data.ipAddress,
        macAddress: data.macAddress,
        vendor: data.vendor,
        purchaseDate: parseFlexibleDate(data.purchaseDate),
        warrantyEndDate: parseFlexibleDate(data.warrantyEndDate),
        licenseExpiryDate: parseFlexibleDate(data.licenseExpiryDate),
        costCenter: data.costCenter,
        assignedToUserId: data.assignedToUserId,
        statusSince: new Date(),
        createdById,
      },
    });
    await recordAudit(tx, { entityType: "ITAsset", entityId: created.id, action: "CREATE", changedById: createdById, newValue: itemCode });
    return created;
  });

  const qrFileName = `qr-${asset.id}.png`;
  await QRCode.toFile(path.join(env.uploadDir, qrFileName), asset.itemCode, { width: 300 });
  return prisma.iTAsset.update({
    where: { id: asset.id },
    data: { qrCodeUrl: publicUrlForFile(qrFileName) },
  });
}

router.post("/", requireRole(Role.IT_TEAM, Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = createSchema.parse(req.body);
  const updated = await createITAssetRecord(data, req.user!.sub);
  res.status(201).json(updated);
});

router.post("/bulk-import", requireRole(Role.IT_TEAM, Role.MANAGER, Role.ADMIN), csvUpload.single("file"), async (req, res) => {
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
  let imported = 0;

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2;
    const parsed = createSchema.safeParse({
      ...records[i],
      serialNumber: records[i].serialNumber || undefined,
      specifications: records[i].specifications || undefined,
      ipAddress: records[i].ipAddress || undefined,
      macAddress: records[i].macAddress || undefined,
      vendor: records[i].vendor || undefined,
      purchaseDate: records[i].purchaseDate || undefined,
      warrantyEndDate: records[i].warrantyEndDate || undefined,
      licenseExpiryDate: records[i].licenseExpiryDate || undefined,
      costCenter: records[i].costCenter || undefined,
    });
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ") });
      continue;
    }
    try {
      await createITAssetRecord(parsed.data, req.user!.sub);
      imported++;
    } catch (e) {
      errors.push({ row: rowNumber, message: (e as Error).message });
    }
  }

  res.json({ imported, failed: errors.length, errors });
});

const updateSchema = createSchema.partial().extend({ status: z.nativeEnum(AssetStatus).optional() });
router.patch("/:id", requireRole(Role.IT_TEAM, Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.iTAsset.findUniqueOrThrow({ where: { id: req.params.id } });
  const statusChanged = data.status !== undefined && data.status !== before.status;
  const asset = await prisma.iTAsset.update({
    where: { id: req.params.id },
    data: {
      ...data,
      purchaseDate: parseFlexibleDate(data.purchaseDate),
      warrantyEndDate: parseFlexibleDate(data.warrantyEndDate),
      licenseExpiryDate: parseFlexibleDate(data.licenseExpiryDate),
      statusSince: statusChanged ? new Date() : undefined,
      downtimeAlertedAt: statusChanged ? null : undefined,
    },
  });
  if (before.status !== asset.status) {
    await recordAudit(prisma, { entityType: "ITAsset", entityId: asset.id, field: "status", oldValue: before.status, newValue: asset.status, action: "UPDATE", changedById: req.user!.sub });
  }
  res.json(asset);
});

const invoiceSchema = z.object({ invoiceNumber: z.string().optional(), amount: z.coerce.number().optional() });
router.post("/:id/invoices", requireRole(Role.IT_TEAM, Role.MANAGER, Role.ADMIN), upload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const data = invoiceSchema.parse(req.body);
  const invoice = await prisma.iTAssetInvoice.create({
    data: {
      assetId: req.params.id,
      fileUrl: publicUrlForFile(req.file.filename),
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
    },
  });
  res.status(201).json(invoice);
});

router.get("/:id/qrcode", async (req, res) => {
  const asset = await prisma.iTAsset.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!asset.qrCodeUrl) throw new ApiError(404, "QR code not generated");
  const fileName = path.basename(asset.qrCodeUrl);
  const filePath = path.join(env.uploadDir, fileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, "QR code file missing");
  res.sendFile(filePath);
});

export default router;
