import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { ITAssetCategory, AssetStatus, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { nextSequenceValue, formatAssetItemCode } from "../sequences/sequence.service";
import { recordAudit } from "../audit/audit.service";
import { publicUrlForFile } from "../../lib/storage";
import { env } from "../../config/env";
import { ApiError } from "../../middleware/errors";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const assets = await prisma.iTAsset.findMany({
    where: {
      category: req.query.category as ITAssetCategory | undefined,
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
  category: z.nativeEnum(ITAssetCategory),
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

router.post("/", requireRole(Role.IT_TEAM, Role.MANAGER), async (req, res) => {
  const data = createSchema.parse(req.body);

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
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : undefined,
        licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate) : undefined,
        costCenter: data.costCenter,
        assignedToUserId: data.assignedToUserId,
        statusSince: new Date(),
        createdById: req.user!.sub,
      },
    });
    await recordAudit(tx, { entityType: "ITAsset", entityId: created.id, action: "CREATE", changedById: req.user!.sub, newValue: itemCode });
    return created;
  });

  const qrFileName = `qr-${asset.id}.png`;
  await QRCode.toFile(path.join(env.uploadDir, qrFileName), asset.itemCode, { width: 300 });
  const updated = await prisma.iTAsset.update({
    where: { id: asset.id },
    data: { qrCodeUrl: publicUrlForFile(qrFileName) },
  });

  res.status(201).json(updated);
});

const updateSchema = createSchema.partial().extend({ status: z.nativeEnum(AssetStatus).optional() });
router.patch("/:id", requireRole(Role.IT_TEAM, Role.MANAGER), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.iTAsset.findUniqueOrThrow({ where: { id: req.params.id } });
  const statusChanged = data.status !== undefined && data.status !== before.status;
  const asset = await prisma.iTAsset.update({
    where: { id: req.params.id },
    data: {
      ...data,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : undefined,
      licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate) : undefined,
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
router.post("/:id/invoices", requireRole(Role.IT_TEAM, Role.MANAGER), upload.single("file"), async (req, res) => {
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
