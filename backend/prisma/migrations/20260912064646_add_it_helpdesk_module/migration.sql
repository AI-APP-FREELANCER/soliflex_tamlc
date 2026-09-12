-- CreateEnum
CREATE TYPE "tms"."HelpdeskCategory" AS ENUM ('LAPTOP_DESKTOP', 'PRINTER', 'NETWORK', 'SOFTWARE', 'ACCESS_REQUEST', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "tms"."HelpdeskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_TICKET_CREATED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_TICKET_ASSIGNED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_STATUS_CHANGED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_COMMENT_ADDED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_TICKET_RESOLVED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_TICKET_CLOSED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_DEADLINE_BREACHED';
ALTER TYPE "tms"."NotificationType" ADD VALUE 'HELPDESK_DEADLINE_MISSING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tms"."Role" ADD VALUE 'EMPLOYEE';
ALTER TYPE "tms"."Role" ADD VALUE 'IT_SUPPORT_ENGINEER';
ALTER TYPE "tms"."Role" ADD VALUE 'IT_TEAM_LEAD';

-- CreateTable
CREATE TABLE "tms"."HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "category" "tms"."HelpdeskCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "tms"."Priority",
    "status" "tms"."HelpdeskStatus" NOT NULL DEFAULT 'OPEN',
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "onHoldReason" TEXT,
    "onHoldSince" TIMESTAMP(3),
    "raisedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "teamLeadId" TEXT,
    "itAssetId" TEXT,
    "deadline" TIMESTAMP(3),
    "deadlineSetAt" TIMESTAMP(3),
    "deadlineBreached" BOOLEAN NOT NULL DEFAULT false,
    "missingDeadlineAlertedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."HelpdeskComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tms"."HelpdeskStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "tms"."HelpdeskStatus",
    "toStatus" "tms"."HelpdeskStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTicket_ticketNumber_key" ON "tms"."HelpdeskTicket"("ticketNumber");

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "tms"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskComment" ADD CONSTRAINT "HelpdeskComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskComment" ADD CONSTRAINT "HelpdeskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskStatusHistory" ADD CONSTRAINT "HelpdeskStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tms"."HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tms"."HelpdeskStatusHistory" ADD CONSTRAINT "HelpdeskStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "tms"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
