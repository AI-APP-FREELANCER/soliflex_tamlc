-- Maintenance module production-release redesign (Oct 2026).
-- Adds: new Ticket statuses, Plant/Department entities, maintenance-only
-- ticket fields (problem type, machine status, delay reason, 5S checklist,
-- production verification/certification), MaintenanceAsset.powerCapacity,
-- and makes Ticket.title optional (no longer collected for new tickets).
-- Nothing existing is dropped or renamed; all new columns are nullable or
-- defaulted, so every historical row stays exactly as it reads today.

-- 1) New enum values on TicketStatus (cannot be used in this same
--    transaction/file, but nothing here needs to use them yet).
ALTER TYPE "tms"."TicketStatus" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';
ALTER TYPE "tms"."TicketStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "tms"."TicketStatus" ADD VALUE IF NOT EXISTS 'VERIFICATION_NEEDED';
ALTER TYPE "tms"."TicketStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "tms"."TicketStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2) New enum values on NotificationType.
ALTER TYPE "tms"."NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_NEEDED';
ALTER TYPE "tms"."NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_REJECTED';

-- 3) New standalone enums.
CREATE TYPE "tms"."ProblemType" AS ENUM ('ELECTRICAL', 'MECHANICAL', 'PNEUMATIC', 'HYDRAULIC', 'OTHERS');
CREATE TYPE "tms"."MachineStatus" AS ENUM ('RUNNING', 'STOPPED');
CREATE TYPE "tms"."DelayReason" AS ENUM ('TECHNICIAN_NOT_AVAILABLE', 'WAITING_FOR_SPARES', 'WAITING_FOR_EXTERNAL_SERVICE', 'NEED_TECHNICAL_SUPPORT', 'OTHERS');
CREATE TYPE "tms"."ChecklistAnswer" AS ENUM ('YES', 'NO', 'NA');
CREATE TYPE "tms"."QualityRating" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- 4) Plant / Department tables.
CREATE TABLE "tms"."Plant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plant_name_key" ON "tms"."Plant"("name");
ALTER TABLE "tms"."Plant" ADD CONSTRAINT "Plant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tms"."Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_name_key" ON "tms"."Department"("name");
ALTER TABLE "tms"."Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Ticket: title becomes optional; new maintenance-only columns.
ALTER TABLE "tms"."Ticket" ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "tms"."Ticket"
  ADD COLUMN "plantId" TEXT,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "problemType" "tms"."ProblemType",
  ADD COLUMN "machineStatus" "tms"."MachineStatus",
  ADD COLUMN "delayReason" "tms"."DelayReason",
  ADD COLUMN "delayNotes" TEXT,
  ADD COLUMN "checklistToolsReclaimed" "tms"."ChecklistAnswer",
  ADD COLUMN "checklistMachineCleaned" "tms"."ChecklistAnswer",
  ADD COLUMN "checklistCableRouting" "tms"."ChecklistAnswer",
  ADD COLUMN "qualityRating" "tms"."QualityRating",
  ADD COLUMN "qualityFeedback" TEXT,
  ADD COLUMN "productionCertified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productionCertifiedAt" TIMESTAMP(3),
  ADD COLUMN "productionCertifiedById" TEXT;

ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "tms"."Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "tms"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_productionCertifiedById_fkey" FOREIGN KEY ("productionCertifiedById") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Machine Details: power capacity on the maintenance asset.
ALTER TABLE "maintenance_inventory"."MaintenanceAsset" ADD COLUMN "powerCapacity" TEXT;
