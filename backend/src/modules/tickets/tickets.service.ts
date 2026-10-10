import { AttachmentType, FixType, NotificationType, OnHoldReason, Prisma, Priority, Role, Ticket, TicketCategory, TicketStatus, User, Workstream } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { canPerform, TicketAction } from "./workflow";
import { canCreateTicket } from "./ticket-permissions";
import { nextSequenceValue, formatTicketNumber } from "../sequences/sequence.service";
import { recordAudit, recordFieldChanges } from "../audit/audit.service";
import { notify } from "../notifications/notifications.service";
import { publicUrlForFile } from "../../lib/storage";
import { withLiveSlaBreach } from "../../lib/live-breach";
import { parseFlexibleDate } from "../../lib/parse-date";
import { env } from "../../config/env";
import { categoriesForWorkstream } from "./ticket-permissions";
import { workstreamScope } from "../../lib/workstream-scope";

const inr = (n: number) => `\u20B9${n.toLocaleString("en-IN")}`;

export interface Actor {
  id: string;
  role: Role;
  workstream: Workstream | null;
  name: string;
}

export interface CreateTicketInput {
  workstream: Workstream;
  category: TicketCategory;
  title: string;
  description: string;
  plantLocation?: string;
  maintenanceAssetId?: string;
  itAssetId?: string;
}

const TICKET_INCLUDE = {
  reportedBy: { select: { id: true, name: true, role: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  manager: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
  attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { uploadedAt: "asc" as const } },
  costEntries: { orderBy: { createdAt: "asc" as const } },
  statusHistory: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TicketInclude;

/** Forward progress is paused while a ticket is on hold: it must be resumed (or the approval decided) first. */
function assertNotOnHold(ticket: { onHold: boolean; onHoldReason: OnHoldReason | null }) {
  if (ticket.onHold) {
    throw new ApiError(400, ticket.onHoldReason === OnHoldReason.APPROVAL ? "This ticket is waiting for manager approval of the fix recommendation" : "This ticket is on hold - resume it first");
  }
}

/** Only an active technician of the ticket's own workstream can be given the work. */
function assertValidAssignee(assignee: User, ticket: { workstream: Workstream }) {
  if (!assignee.active) {
    throw new ApiError(400, "That user is inactive and cannot be assigned tickets");
  }
  if (assignee.role !== Role.MECHANIC && assignee.role !== Role.IT_TEAM) {
    throw new ApiError(400, "Tickets can only be assigned to a Mechanic or IT Team technician");
  }
  if (assignee.workstream !== ticket.workstream) {
    throw new ApiError(400, "Assignee must belong to the same workstream as the ticket");
  }
}

async function findManagersForWorkstream(workstream: Workstream) {
  return prisma.user.findMany({
    where: { role: Role.MANAGER, active: true, OR: [{ workstream }, { workstream: null }] },
  });
}

export async function createTicket(actor: Actor, input: CreateTicketInput) {
  if (!categoriesForWorkstream(input.workstream).includes(input.category)) {
    throw new ApiError(400, `That category belongs to the ${input.workstream === Workstream.IT ? "Maintenance" : "IT"} workstream, not ${input.workstream === Workstream.IT ? "IT" : "Maintenance"}`);
  }
  const scope = workstreamScope(actor);
  if (scope && scope !== input.workstream) {
    throw new ApiError(403, `Your account works on ${scope === Workstream.IT ? "IT" : "Maintenance"} tickets only`);
  }
  if (!canCreateTicket(actor.role, input.workstream, input.category)) {
    throw new ApiError(403, "Your role cannot raise tickets in this workstream/category");
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx as typeof prisma, `ticket:${input.workstream}`, 1000);
    const ticketNumber = formatTicketNumber(input.workstream, seq);

    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        workstream: input.workstream,
        category: input.category,
        title: input.title,
        description: input.description,
        plantLocation: input.plantLocation,
        maintenanceAssetId: input.maintenanceAssetId,
        itAssetId: input.itAssetId,
        reportedById: actor.id,
        status: TicketStatus.OPEN,
      },
    });

    await tx.ticketStatusHistory.create({
      data: { ticketId: created.id, toStatus: TicketStatus.OPEN, changedById: actor.id, comment: "Ticket raised" },
    });

    await recordAudit(tx, {
      entityType: "Ticket",
      entityId: created.id,
      action: "CREATE",
      changedById: actor.id,
      newValue: ticketNumber,
    });

    const managers = await findManagersForWorkstream(input.workstream);
    for (const manager of managers) {
      await notify(
        tx,
        manager.id,
        NotificationType.TICKET_CREATED,
        `New ${input.workstream} ticket ${ticketNumber} raised: ${input.title}`,
        `/tickets/${created.id}`
      );
    }

    return created;
  });

  return getTicket(ticket.id);
}

export interface TicketFilter {
  workstream?: Workstream;
  status?: TicketStatus;
  assignedToId?: string;
  reportedById?: string;
  priority?: Priority;
  onHold?: boolean;
  search?: string;
  createdAtRange?: { gte?: Date; lte?: Date };
}

export async function listTickets(filter: TicketFilter) {
  const tickets = await prisma.ticket.findMany({
    where: {
      workstream: filter.workstream,
      status: filter.status,
      assignedToId: filter.assignedToId,
      reportedById: filter.reportedById,
      priority: filter.priority,
      onHold: filter.onHold,
      ...(filter.createdAtRange ? { createdAt: filter.createdAtRange } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { ticketNumber: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return tickets.map((t) => withLiveSlaBreach(t, now));
}

export async function getTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!ticket) throw new ApiError(404, "Ticket not found");
  // approvalThreshold lets the apps explain the rule next to the diagnosis form.
  return { ...withLiveSlaBreach(ticket), approvalThreshold: env.approvalCostThreshold };
}

function assertAction(ticket: Ticket, actor: Actor, action: TicketAction) {
  const check = canPerform(action, ticket, actor);
  if (!check.allowed) {
    throw new ApiError(403, check.reason ?? "Action not allowed");
  }
}

export async function assignTicket(actor: Actor, ticketId: string, assignedToId: string, priority: Priority, targetCompletionDate?: string, effortEstimateHours?: number) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "ASSIGN");

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assignedToId } });
  assertValidAssignee(assignee, ticket);
  const targetDate = parseFlexibleDate(targetCompletionDate);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId,
        managerId: actor.id,
        priority,
        targetCompletionDate: targetDate,
        effortEstimateHours,
        status: TicketStatus.ASSIGNED,
      },
    });
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.ASSIGNED, changedById: actor.id, comment: `Assigned to ${assignee.name}` },
    });
    await recordFieldChanges(tx, "Ticket", ticketId, actor.id, { status: ticket.status, assignedToId: ticket.assignedToId }, { status: updated.status, assignedToId: updated.assignedToId });
    await notify(tx, assignedToId, NotificationType.TICKET_ASSIGNED, `You were assigned ticket ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
    return updated;
  });
}

export interface UpdateAssignmentInput {
  assignedToId?: string;
  targetCompletionDate?: string | null;
  effortEstimateHours?: number;
}

/**
 * Edits assignment details on a ticket that's already past OPEN — assignTicket()
 * only fires on the OPEN->ASSIGNED transition, so once a ticket is in progress
 * there was previously no way to reassign it or change its target date/effort
 * estimate without resetting its workflow status. This never changes status.
 */
export async function updateAssignment(actor: Actor, ticketId: string, input: UpdateAssignmentInput) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (actor.role !== Role.MANAGER && actor.role !== Role.ADMIN) {
    throw new ApiError(403, "Only a manager can edit ticket assignment details");
  }
  if (ticket.status === TicketStatus.CLOSED) {
    throw new ApiError(400, "Cannot edit assignment details on a closed ticket");
  }

  let assignee: User | undefined;
  if (input.assignedToId) {
    assignee = await prisma.user.findUniqueOrThrow({ where: { id: input.assignedToId } });
    assertValidAssignee(assignee, ticket);
  }
  const newTargetDate = input.targetCompletionDate ? parseFlexibleDate(input.targetCompletionDate) : undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: input.assignedToId ?? undefined,
        managerId: input.assignedToId ? actor.id : undefined,
        targetCompletionDate: input.targetCompletionDate !== undefined ? (newTargetDate ?? null) : undefined,
        effortEstimateHours: input.effortEstimateHours,
      },
    });
    await recordFieldChanges(
      tx,
      "Ticket",
      ticketId,
      actor.id,
      { assignedToId: ticket.assignedToId, targetCompletionDate: ticket.targetCompletionDate, effortEstimateHours: ticket.effortEstimateHours },
      { assignedToId: updated.assignedToId, targetCompletionDate: updated.targetCompletionDate, effortEstimateHours: updated.effortEstimateHours }
    );
    if (assignee && input.assignedToId !== ticket.assignedToId) {
      await notify(tx, input.assignedToId!, NotificationType.TICKET_ASSIGNED, `You were assigned ticket ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function updatePriority(actor: Actor, ticketId: string, priority: Priority) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (actor.role !== Role.MANAGER && actor.role !== Role.ADMIN) {
    throw new ApiError(403, "Only a manager can change ticket priority");
  }
  if (ticket.status === TicketStatus.CLOSED) {
    throw new ApiError(400, "Cannot change priority on a closed ticket");
  }
  if (ticket.priority === priority) {
    return getTicket(ticketId);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { priority } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, field: "priority", oldValue: ticket.priority ?? undefined, newValue: priority, action: "UPDATE", changedById: actor.id });
    return updated;
  });
}

export async function startProgress(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "START_PROGRESS");
  assertNotOnHold(ticket);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.IN_PROGRESS } });
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.IN_PROGRESS, changedById: actor.id },
    });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.STATUS_CHANGED, `${actor.name} started work on ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export interface RecommendationInput {
  diagnosis: string;
  recommendedFix: string;
  fixType: FixType;
  /** Estimated spare-part cost in INR; required for a spare part replacement. */
  estimatedCost?: number;
}

/**
 * The engineer's diagnosis. What happens next depends on what the job needs:
 *  - minor adjustment (no spare part)            -> no approval, can close directly
 *  - spare part below the cost threshold         -> no approval, can close directly
 *  - spare part at/above the cost threshold      -> held for manager approval, then
 *                                                   the normal review chain
 */
export async function submitRecommendation(actor: Actor, ticketId: string, input: RecommendationInput) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { attachments: true, costEntries: true } });
  assertAction(ticket, actor, "SUBMIT_RECOMMENDATION");
  assertNotOnHold(ticket);
  if (ticket.workstream !== Workstream.MAINTENANCE) {
    throw new ApiError(400, "IT tickets do not use the diagnosis/approval steps. Add a comment with what you did and close the ticket.");
  }
  const hasPreFixPhoto = ticket.attachments.some((a) => a.type === AttachmentType.PRE_FIX_PHOTO);
  if (!hasPreFixPhoto) {
    throw new ApiError(400, "Upload at least one pre-fix photo of the defect before submitting a diagnosis");
  }

  const threshold = env.approvalCostThreshold;
  const recordedCost = ticket.actualCost ?? 0;
  let estimatedCost: number | null = null;
  let effectiveCost = recordedCost;
  if (input.fixType === FixType.SPARE_PART_REPLACEMENT) {
    if (input.estimatedCost === undefined || !(input.estimatedCost > 0)) {
      throw new ApiError(400, "Enter the estimated cost of the spare part (in rupees) for a spare part replacement");
    }
    estimatedCost = input.estimatedCost;
    effectiveCost = Math.max(estimatedCost, recordedCost);
  } else if (ticket.costEntries.some((c) => c.sparePartUsed)) {
    throw new ApiError(400, "Spare parts are already recorded on this ticket - choose Spare part replacement");
  }
  const approvalRequired = effectiveCost >= threshold;
  if (approvalRequired && !ticket.managerId) {
    throw new ApiError(400, "Ticket has no owning manager to approve this recommendation");
  }

  return prisma.$transaction(async (tx) => {
    const manager = ticket.managerId ? await tx.user.findUnique({ where: { id: ticket.managerId } }) : null;
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        diagnosis: input.diagnosis,
        recommendedFix: input.recommendedFix,
        fixType: input.fixType,
        estimatedCost,
        approvalRequired,
        // a fresh diagnosis always starts a fresh approval
        approvedById: null,
        approvedAt: null,
        ...(approvalRequired
          ? { onHold: true, onHoldReason: OnHoldReason.APPROVAL, onHoldDetail: manager?.name ?? null, onHoldSince: new Date() }
          : {}),
      },
    });
    const outcome = approvalRequired
      ? `manager approval required (${inr(effectiveCost)} is ${inr(threshold)} or more)`
      : `no approval needed${input.fixType === FixType.SPARE_PART_REPLACEMENT ? ` (${inr(effectiveCost)} is below ${inr(threshold)})` : " (minor adjustment)"}`;
    await recordAudit(tx, {
      entityType: "Ticket",
      entityId: ticketId,
      action: "RECOMMENDATION_SUBMITTED",
      changedById: actor.id,
      newValue: `${input.fixType === FixType.SPARE_PART_REPLACEMENT ? "Spare part replacement" : "Minor adjustment"}: ${input.recommendedFix} - ${outcome}`,
    });
    if (ticket.managerId && ticket.managerId !== actor.id) {
      if (approvalRequired) {
        await notify(tx, ticket.managerId, NotificationType.APPROVAL_REQUESTED, `${actor.name} submitted a fix recommendation for ${ticket.ticketNumber} awaiting your approval (est. ${inr(effectiveCost)})`, `/tickets/${ticketId}`);
      } else {
        await notify(tx, ticket.managerId, NotificationType.STATUS_CHANGED, `${actor.name} diagnosed ${ticket.ticketNumber}: ${outcome}`, `/tickets/${ticketId}`);
      }
    }
    return updated;
  });
}

export async function decideRecommendation(actor: Actor, ticketId: string, approve: boolean, comment?: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, approve ? "APPROVE_RECOMMENDATION" : "REJECT_RECOMMENDATION");
  if (!ticket.onHold || ticket.onHoldReason !== OnHoldReason.APPROVAL) {
    throw new ApiError(400, "Ticket is not awaiting approval");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        onHold: false,
        onHoldReason: null,
        onHoldDetail: null,
        onHoldSince: null,
        approvedById: approve ? actor.id : null,
        approvedAt: approve ? new Date() : null,
      },
    });
    if (comment) {
      await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: comment } });
    }
    await recordAudit(tx, {
      entityType: "Ticket",
      entityId: ticketId,
      action: approve ? "RECOMMENDATION_APPROVED" : "RECOMMENDATION_REJECTED",
      changedById: actor.id,
    });
    if (ticket.assignedToId) {
      await notify(
        tx,
        ticket.assignedToId,
        NotificationType.APPROVAL_DECIDED,
        `${actor.name} ${approve ? "approved" : "rejected"} your fix recommendation for ${ticket.ticketNumber}`,
        `/tickets/${ticketId}`
      );
    }
    return updated;
  });
}

export async function markFirstLineReview(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { attachments: true } });
  assertAction(ticket, actor, "MARK_FIRST_LINE_REVIEW");
  assertNotOnHold(ticket);
  if (ticket.workstream !== Workstream.MAINTENANCE) {
    throw new ApiError(400, "IT tickets do not have a review chain - close the ticket once the issue is resolved");
  }
  if (ticket.approvalRequired && !ticket.approvedAt) {
    throw new ApiError(400, "The fix recommendation must be approved by the manager before submitting for review");
  }
  const hasPostFixPhoto = ticket.attachments.some((a) => a.type === AttachmentType.POST_FIX_PHOTO);
  if (!hasPostFixPhoto) {
    throw new ApiError(400, "Upload at least one post-fix photo before submitting for review");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.FIRST_LINE_REVIEW } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.FIRST_LINE_REVIEW, changedById: actor.id } });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.STATUS_CHANGED, `${ticket.ticketNumber} is ready for 1st line review`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function markJobCompleted(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "MARK_JOB_COMPLETED");
  assertNotOnHold(ticket);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.JOB_COMPLETED } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.JOB_COMPLETED, changedById: actor.id } });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.STATUS_CHANGED, `${ticket.ticketNumber} marked job completed — ready for final review`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function markFinalReview(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "MARK_FINAL_REVIEW");
  assertNotOnHold(ticket);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.FINAL_REVIEW } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.FINAL_REVIEW, changedById: actor.id } });
    return updated;
  });
}

export async function closeTicket(actor: Actor, ticketId: string, confirmEquipmentOperational: boolean, closingComment?: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { attachments: true, comments: true } });
  assertAction(ticket, actor, "CLOSE");
  assertNotOnHold(ticket);

  if (!confirmEquipmentOperational) {
    throw new ApiError(400, "You must confirm the equipment/asset is operational before closing");
  }
  const hasPostFixPhoto = ticket.attachments.some((a) => a.type === AttachmentType.POST_FIX_PHOTO);
  if (!hasPostFixPhoto) {
    throw new ApiError(400, "At least one post-fix photo is required before closing");
  }
  if (ticket.comments.length === 0 && !closingComment) {
    throw new ApiError(400, "Add a closing comment summarizing the resolution before closing");
  }

  return prisma.$transaction(async (tx) => {
    if (closingComment) {
      await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: closingComment } });
    }
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED, closedById: actor.id, closedAt: new Date() },
    });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.CLOSED, changedById: actor.id, comment: "Verified and closed" } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "CLOSE", changedById: actor.id });
    if (ticket.assignedToId) {
      await notify(tx, ticket.assignedToId, NotificationType.TICKET_CLOSED, `${ticket.ticketNumber} was verified and closed`, `/tickets/${ticketId}`);
    }
    await notify(tx, ticket.reportedById, NotificationType.TICKET_CLOSED, `Your ticket ${ticket.ticketNumber} was closed`, `/tickets/${ticketId}`);
    return updated;
  });
}

/**
 * Fast close by the engineer (or a manager), skipping the review chain.
 *  - Maintenance: allowed only once a diagnosis shows no approval is needed, i.e. a
 *    minor adjustment or a spare part below the cost threshold. Needs a post-fix photo.
 *  - IT: always allowed. A resolution note is required; a photo is not.
 */
export async function closeDirect(actor: Actor, ticketId: string, confirmResolved: boolean, closingComment?: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { attachments: true, comments: true } });
  assertAction(ticket, actor, "DIRECT_CLOSE");
  assertNotOnHold(ticket);
  const isMaintenance = ticket.workstream === Workstream.MAINTENANCE;

  if (isMaintenance) {
    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new ApiError(400, "This ticket is already in the review stage - a manager closes it from final review");
    }
    if (!ticket.fixType) {
      throw new ApiError(400, "Submit your diagnosis first, stating whether it is a spare part replacement or a minor adjustment");
    }
    const threshold = env.approvalCostThreshold;
    if (ticket.approvalRequired) {
      throw new ApiError(400, `This job needs manager approval (cost is ${inr(threshold)} or more) - it follows the approval and review steps`);
    }
    if ((ticket.actualCost ?? 0) >= threshold) {
      throw new ApiError(400, `Recorded costs have reached ${inr(threshold)} - resubmit the diagnosis so the manager can approve it`);
    }
    if (!ticket.attachments.some((a) => a.type === AttachmentType.POST_FIX_PHOTO)) {
      throw new ApiError(400, "Upload at least one post-fix photo before closing");
    }
  }
  if (!confirmResolved) {
    throw new ApiError(400, isMaintenance ? "You must confirm the equipment/asset is operational before closing" : "You must confirm the issue is resolved before closing");
  }
  if (ticket.comments.length === 0 && !closingComment) {
    throw new ApiError(400, "Add a closing comment summarizing the resolution before closing");
  }

  return prisma.$transaction(async (tx) => {
    if (closingComment) {
      await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: closingComment } });
    }
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED, closedById: actor.id, closedAt: new Date() },
    });
    const how = isMaintenance
      ? ticket.fixType === FixType.SPARE_PART_REPLACEMENT
        ? `Closed by engineer - spare part replacement under ${inr(env.approvalCostThreshold)}, no approval needed`
        : "Closed by engineer - minor adjustment, no approval needed"
      : "Resolved and closed";
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.CLOSED, changedById: actor.id, comment: how } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "CLOSE", changedById: actor.id, newValue: how });
    const recipients = new Set([ticket.managerId, ticket.reportedById].filter(Boolean) as string[]);
    recipients.delete(actor.id);
    for (const userId of recipients) {
      await notify(tx, userId, NotificationType.TICKET_CLOSED, `${ticket.ticketNumber} was closed by ${actor.name}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function reopenTicket(actor: Actor, ticketId: string, reason: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "REOPEN");
  if (!reason.trim()) {
    throw new ApiError(400, "Explain why this ticket is being reopened");
  }

  return prisma.$transaction(async (tx) => {
    await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: reason } });
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.IN_PROGRESS, closedById: null, closedAt: null },
    });
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.IN_PROGRESS, changedById: actor.id, comment: reason },
    });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "REOPEN", changedById: actor.id, newValue: reason });

    const notifyIds = new Set([ticket.assignedToId, ticket.reportedById, ticket.managerId].filter(Boolean) as string[]);
    notifyIds.delete(actor.id);
    for (const userId of notifyIds) {
      await notify(tx, userId, NotificationType.STATUS_CHANGED, `${ticket.ticketNumber} was reopened: ${reason}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function holdTicket(actor: Actor, ticketId: string, reason: OnHoldReason, detail: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "HOLD");
  if (ticket.onHold) {
    throw new ApiError(400, "This ticket is already on hold");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { onHold: true, onHoldReason: reason, onHoldDetail: detail, onHoldSince: new Date() },
    });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "HOLD", changedById: actor.id, newValue: `${reason}: ${detail}` });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.ON_HOLD, `${ticket.ticketNumber} put on hold (${reason})`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function resumeTicket(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "RESUME");
  if (!ticket.onHold) {
    throw new ApiError(400, "This ticket is not on hold");
  }
  if (ticket.onHoldReason === OnHoldReason.APPROVAL) {
    throw new ApiError(400, "This ticket is awaiting manager approval — use approve/reject instead of resume");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { onHold: false, onHoldReason: null, onHoldDetail: null, onHoldSince: null },
    });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "RESUME", changedById: actor.id });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.RESUMED, `${ticket.ticketNumber} resumed`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function addComment(actor: Actor, ticketId: string, body: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  const comment = await prisma.ticketComment.create({ data: { ticketId, authorId: actor.id, body } });
  const notifyIds = new Set([ticket.reportedById, ticket.assignedToId, ticket.managerId].filter(Boolean) as string[]);
  notifyIds.delete(actor.id);
  for (const userId of notifyIds) {
    await notify(prisma, userId, NotificationType.COMMENT_ADDED, `New comment on ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
  }
  return comment;
}

export async function addAttachment(actor: Actor, ticketId: string, file: Express.Multer.File, type: AttachmentType) {
  if (!Object.values(AttachmentType).includes(type)) {
    throw new ApiError(400, `Attachment type must be one of: ${Object.values(AttachmentType).join(", ")}`);
  }
  await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  return prisma.ticketAttachment.create({
    data: {
      ticketId,
      type,
      fileUrl: publicUrlForFile(file.filename),
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: actor.id,
    },
  });
}

export async function addCostEntry(actor: Actor, ticketId: string, description: string, amount: number, sparePartUsed: boolean) {
  if (actor.role === Role.PRODUCTION) {
    throw new ApiError(403, "Only managers and technicians can record costs");
  }
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (ticket.status === TicketStatus.CLOSED) {
    throw new ApiError(400, "Cannot add costs to a closed ticket");
  }
  if (ticket.workstream === Workstream.MAINTENANCE && ticket.fixType) {
    if (ticket.fixType === FixType.MINOR_ADJUSTMENT && sparePartUsed) {
      throw new ApiError(400, "This ticket was diagnosed as a minor adjustment - resubmit the diagnosis as a spare part replacement to record a spare part");
    }
    const threshold = env.approvalCostThreshold;
    if (!ticket.approvalRequired && (ticket.actualCost ?? 0) + amount >= threshold) {
      throw new ApiError(400, `This job was cleared without approval because the cost was under ${inr(threshold)}. With this entry the total reaches ${inr((ticket.actualCost ?? 0) + amount)} - resubmit the diagnosis with the revised cost so the manager can approve it`);
    }
  }
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketCostEntry.create({ data: { ticketId, description, amount, sparePartUsed } });
    const agg = await tx.ticketCostEntry.aggregate({ where: { ticketId }, _sum: { amount: true } });
    await tx.ticket.update({ where: { id: ticketId }, data: { actualCost: agg._sum.amount ?? 0 } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "COST_ENTRY_ADDED", changedById: actor.id, newValue: `${description}: ${amount}` });
    return created;
  });
  return entry;
}
