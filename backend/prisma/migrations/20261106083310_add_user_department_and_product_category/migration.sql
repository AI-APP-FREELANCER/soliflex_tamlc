-- AlterTable
ALTER TABLE "tms"."User" ADD COLUMN     "productCategory" TEXT;

-- CreateTable
CREATE TABLE "tms"."UserDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartment_name_key" ON "tms"."UserDepartment"("name");

-- AddForeignKey
ALTER TABLE "tms"."UserDepartment" ADD CONSTRAINT "UserDepartment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
