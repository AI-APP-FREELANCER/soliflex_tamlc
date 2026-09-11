-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "it_inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "maintenance_inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tms";

-- CreateEnum
CREATE TYPE "tms"."Role" AS ENUM ('MANAGER', 'MECHANIC', 'IT_TEAM', 'PRODUCTION', 'ADMIN');

-- CreateEnum
CREATE TYPE "tms"."Workstream" AS ENUM ('MAINTENANCE', 'IT');

-- CreateEnum
CREATE TYPE "tms"."TicketCategory" AS ENUM ('PRODUCTION_MACHINE', 'FACTORY_FACILITY', 'OTHER_MACHINE', 'WORKSTATION', 'LAPTOP', 'NETWORK_GEAR', 'SERVER', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "tms"."TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'FIRST_LINE_REVIEW', 'JOB_COMPLETED', 'FINAL_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "tms"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "tms"."OnHoldReason" AS ENUM ('VENDOR', 'MATERIAL', 'APPROVAL');

-- CreateEnum
CREATE TYPE "tms"."AttachmentType" AS ENUM ('PRE_FIX_PHOTO', 'POST_FIX_PHOTO', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "tms"."NotificationType" AS ENUM ('TICKET_CREATED', 'TICKET_ASSIGNED', 'STATUS_CHANGED', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'SLA_BREACHED', 'COMMENT_ADDED', 'ON_HOLD', 'RESUMED', 'TICKET_CLOSED');

-- CreateEnum
CREATE TYPE "tms"."AssetStatus" AS ENUM ('ACTIVE', 'DOWN', 'RETIRED');

-- CreateEnum
CREATE TYPE "maintenance_inventory"."MaintenanceAssetCategory" AS ENUM ('PRODUCTION_MACHINE', 'PLANT_EQUIPMENT', 'PERIPHERAL_ATTACHMENT', 'PHYSICAL_TOOL');

-- CreateEnum
CREATE TYPE "it_inventory"."ITAssetCategory" AS ENUM ('WORKSTATION', 'LAPTOP', 'NETWORK_GEAR', 'SERVER', 'SOFTWARE_LICENSE');

-- CreateTable
CREATE TABLE "tms"."User" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "tms"."Role" NOT NULL,
    "workstream" "tms"."Workstream",
    "department" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."SequenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tms"."Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "workstream" "tms"."Workstream" NOT NULL,
    "category" "tms"."TicketCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "plantLocation" TEXT,
    "maintenanceAssetId" TEXT,
    "itAssetId" TEXT,
    "status" "tms"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "tms"."Priority",
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "onHoldReason" "tms"."OnHoldReason",
    "onHoldDetail" TEXT,
    "onHoldSince" TIMESTAMP(3),
    "resumeStatus" "tms"."TicketStatus",
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "managerId" TEXT,
    "diagnosis" TEXT,
    "recommendedFix" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effortEstimateHours" DOUBLE PRECISION,
    "targetCompletionDate" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "actualCost" DOUBLE PRECISION,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."TicketStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "tms"."TicketStatus",
    "toStatus" "tms"."TicketStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "tms"."AttachmentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."TicketCostEntry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sparePartUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "tms"."NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "action" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_inventory"."MaintenanceAsset" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "maintenance_inventory"."MaintenanceAssetCategory" NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "plantLocation" TEXT,
    "specifications" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyStartDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "status" "tms"."AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "qrCodeUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_inventory"."MaintenanceAssetPhoto" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAssetPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_inventory"."ITAsset" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "it_inventory"."ITAssetCategory" NOT NULL,
    "serialNumber" TEXT,
    "specifications" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "vendor" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3),
    "costCenter" TEXT,
    "assignedToUserId" TEXT,
    "status" "tms"."AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "qrCodeUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_inventory"."ITAssetInvoice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "amount" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITAssetInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "tms"."User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "tms"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "tms"."RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "tms"."Ticket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAsset_itemCode_key" ON "maintenance_inventory"."MaintenanceAsset"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_itemCode_key" ON "it_inventory"."ITAsset"("itemCode");

-- AddForeignKey
ALTER TABLE "tms"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tms"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."TicketCostEntry" ADD CONSTRAINT "TicketCostEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tms"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_inventory"."MaintenanceAssetPhoto" ADD CONSTRAINT "MaintenanceAssetPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "maintenance_inventory"."MaintenanceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_inventory"."ITAssetInvoice" ADD CONSTRAINT "ITAssetInvoice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "it_inventory"."ITAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
