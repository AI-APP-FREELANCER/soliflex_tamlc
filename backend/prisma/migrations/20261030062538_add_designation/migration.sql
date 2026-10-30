-- AlterTable
ALTER TABLE "tms"."Ticket" ADD COLUMN     "designationId" TEXT;

-- CreateTable
CREATE TABLE "tms"."Designation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_name_key" ON "tms"."Designation"("name");

-- AddForeignKey
ALTER TABLE "tms"."Ticket" ADD CONSTRAINT "Ticket_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "tms"."Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."Designation" ADD CONSTRAINT "Designation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
