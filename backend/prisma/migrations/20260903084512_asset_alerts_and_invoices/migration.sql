-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tms"."NotificationType" ADD VALUE 'ASSET_EXPIRING';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'ASSET_DOWNTIME';

-- AlterTable
ALTER TABLE "it_inventory"."ITAsset" ADD COLUMN     "downtimeAlertedAt" TIMESTAMP(3),
ADD COLUMN     "expiryAlertedAt" TIMESTAMP(3),
ADD COLUMN     "statusSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "maintenance_inventory"."MaintenanceAsset" ADD COLUMN     "downtimeAlertedAt" TIMESTAMP(3),
ADD COLUMN     "expiryAlertedAt" TIMESTAMP(3),
ADD COLUMN     "statusSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "maintenance_inventory"."MaintenanceAssetInvoice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "amount" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAssetInvoice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "maintenance_inventory"."MaintenanceAssetInvoice" ADD CONSTRAINT "MaintenanceAssetInvoice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "maintenance_inventory"."MaintenanceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
