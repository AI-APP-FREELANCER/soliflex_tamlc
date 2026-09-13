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
  const assets = await prisma.maintenanceAsset.findMany({
    where: {
      category: req.query.category ? normalizeCategory(String(req.query.category)) : undefined,
      status: req.query.status as AssetStatus | undefined,
      OR: req.query.search
        ? [
            { name: { contains: String(req.query.search), mode: "insensitive" } },
            { itemCode: { contains: String(req.query.search), mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { photos: true, invoices: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(assets);
});

router.get("/categories", async (_req, res) => {
  const rows = await prisma.maintenanceAsset.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  res.json(rows.map((r) => r.category));
});

const BULK_IMPORT_HEADERS = [
  "name",
  "category",
  "model",
  "manufacturer",
  "plantLocation",
  "specifications",
  "purchaseDate",
  "warrantyStartDate",
  "warrantyEndDate",
];

router.get("/template", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), (_req, res) => {
  const csv = buildCsv(BULK_IMPORT_HEADERS, [
    [
      "Extrusion Line 4",
      "PRODUCTION_MACHINE",
      "EX-4000",
      "Reifenhauser",
      "Plant A - Bay 4",
      "Blown film extrusion line, 3-layer",
      "2024-01-15",
      "2024-01-15",
      "2027-01-15",
    ],
  ]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=maintenance-assets-template.csv");
  res.send(csv);
});

router.get("/:id", async (req, res) => {
  const asset = await prisma.maintenanceAsset.findUnique({ where: { id: req.params.id }, include: { photos: true, invoices: true } });
  if (!asset) throw new ApiError(404, "Asset not found");
  res.json(asset);
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1).transform(normalizeCategory),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  plantLocation: z.string().optional(),
  specifications: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
});

async function createMaintenanceAssetRecord(data: z.infer<typeof createSchema>, createdById: string) {
  const asset = await prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx as typeof prisma, "asset:MAINTENANCE", 0);
    const itemCode = formatAssetItemCode("MAINTENANCE", seq);
    const created = await tx.maintenanceAsset.create({
      data: {
        itemCode,
        name: data.name,
        category: data.category,
        model: data.model,
        manufacturer: data.manufacturer,
        plantLocation: data.plantLocation,
        specifications: data.specifications,
        purchaseDate: parseFlexibleDate(data.purchaseDate),
        warrantyStartDate: parseFlexibleDate(data.warrantyStartDate),
        warrantyEndDate: parseFlexibleDate(data.warrantyEndDate),
        statusSince: new Date(),
        createdById,
      },
    });
    await recordAudit(tx, { entityType: "MaintenanceAsset", entityId: created.id, action: "CREATE", changedById: createdById, newValue: itemCode });
    return created;
  });

  const qrFileName = `qr-${asset.id}.png`;
  await QRCode.toFile(path.join(env.uploadDir, qrFileName), asset.itemCode, { width: 300 });
  return prisma.maintenanceAsset.update({
    where: { id: asset.id },
    data: { qrCodeUrl: publicUrlForFile(qrFileName) },
  });
}

// Onboarding restricted to Admin team (factory/facility) and Production team (production machines) per spec §1;
// Managers retain full access.
router.post("/", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), async (req, res) => {
  const data = createSchema.parse(req.body);
  const updated = await createMaintenanceAssetRecord(data, req.user!.sub);
  res.status(201).json(updated);
});

router.post("/bulk-import", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), csvUpload.single("file"), async (req, res) => {
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
    const rowNumber = i + 2; // account for the header row and 1-based row numbering
    const parsed = createSchema.safeParse({
      ...records[i],
      model: records[i].model || undefined,
      manufacturer: records[i].manufacturer || undefined,
      plantLocation: records[i].plantLocation || undefined,
      specifications: records[i].specifications || undefined,
      purchaseDate: records[i].purchaseDate || undefined,
      warrantyStartDate: records[i].warrantyStartDate || undefined,
      warrantyEndDate: records[i].warrantyEndDate || undefined,
    });
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ") });
      continue;
    }
    try {
      await createMaintenanceAssetRecord(parsed.data, req.user!.sub);
      imported++;
    } catch (e) {
      errors.push({ row: rowNumber, message: (e as Error).message });
    }
  }

  res.json({ imported, failed: errors.length, errors });
});

const updateSchema = createSchema.partial().extend({ status: z.nativeEnum(AssetStatus).optional() });
router.patch("/:id", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.maintenanceAsset.findUniqueOrThrow({ where: { id: req.params.id } });
  const statusChanged = data.status !== undefined && data.status !== before.status;
  const asset = await prisma.maintenanceAsset.update({
    where: { id: req.params.id },
    data: {
      ...data,
      purchaseDate: parseFlexibleDate(data.purchaseDate),
      warrantyStartDate: parseFlexibleDate(data.warrantyStartDate),
      warrantyEndDate: parseFlexibleDate(data.warrantyEndDate),
      statusSince: statusChanged ? new Date() : undefined,
      downtimeAlertedAt: statusChanged ? null : undefined,
    },
  });
  if (before.status !== asset.status) {
    await recordAudit(prisma, { entityType: "MaintenanceAsset", entityId: asset.id, field: "status", oldValue: before.status, newValue: asset.status, action: "UPDATE", changedById: req.user!.sub });
  }
  res.json(asset);
});

router.post("/:id/photos", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), upload.array("photos", 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const photos = await prisma.$transaction(
    files.map((file) =>
      prisma.maintenanceAssetPhoto.create({
        data: { assetId: req.params.id, fileUrl: publicUrlForFile(file.filename), caption: req.body.caption },
      })
    )
  );
  res.status(201).json(photos);
});

const invoiceSchema = z.object({ invoiceNumber: z.string().optional(), amount: z.coerce.number().optional() });
router.post("/:id/invoices", requireRole(Role.ADMIN, Role.PRODUCTION, Role.MANAGER), upload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const data = invoiceSchema.parse(req.body);
  const invoice = await prisma.maintenanceAssetInvoice.create({
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
  const asset = await prisma.maintenanceAsset.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!asset.qrCodeUrl) throw new ApiError(404, "QR code not generated");
  const fileName = path.basename(asset.qrCodeUrl);
  const filePath = path.join(env.uploadDir, fileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, "QR code file missing");
  res.sendFile(filePath);
});

export default router;
