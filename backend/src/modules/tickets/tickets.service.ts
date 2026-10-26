import {
  ChecklistAnswer,
  DelayReason,
  MachineStatus,
  NotificationType,
  Prisma,
  Priority,
  ProblemType,
  QualityRating,
  Role,
  Ticket,
  TicketCategory,
  TicketStatus,
  User,
  Workstream,
  AttachmentType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errors";
import { canPerform, TicketAction } from "./workflow";
import { canCreateTicket, categoriesForWorkstream } from "./ticket-permissions";
import { nextSequenceValue, formatTicketNumber } from "../sequences/sequence.service";
import { recordAudit, recordFieldChanges } from "../audit/audit.service";
import { notify } from "../notifications/notifications.service";
import { publicUrlForFile } from "../../lib/storage";
import { withLiveSlaBreach } from "../../lib/live-breach";
import { parseFlexibleDate } from "../../lib/parse-date";
import { workstreamScope } from "../../lib/workstream-scope";

export interface Actor {
  id: string;
  role: Role;
  workstream: Workstream | null;
  name: string;
}

export interface CreateTicketInput {
  workstream: Workstream;
  category: TicketCategory;
  /** IT: required. Maintenance: no longer collected (kept for API back-compat only). */
  title?: string;
  description: string;
  /** Maintenance only, going forward. */
  plantId?: string;
  departmentId?: string;
  problemType?: ProblemType;
  machineStatus?: MachineStatus;
  maintenanceAssetId?: string;
  itAssetId?: string;
}

const TICKET_INCLUDE = {
  reportedBy: { select: { id: true, name: true, role: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  manager: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  productionCertifiedBy: { select: { id: true, name: true } },
  plant: true,
  department: true,
  comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
  attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { uploadedAt: "asc" as const } },
  costEntries: { orderBy: { createdAt: "asc" as const } },
  statusHistory: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TicketInclude;

const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  ELECTRICAL: "Electrical",
  MECHANICAL: "Mechanical",
  PNEUMATIC: "Pneumatic",
  HYDRAULIC: "Hydraulic",
  OTHERS: "Other",
};

/** Falls back to a composed label for tickets raised after Title was removed from the maintenance form. */
function displayTitle<T extends { title: string | null; problemType: ProblemType | null; plant?: { name: string } | null; department?: { name: string } | null; ticketNumber: string }>(t: T): string {
  if (t.title) return t.title;
  const parts = [t.problemType ? PROBLEM_TYPE_LABELS[t.problemType] : null, t.department?.name, t.plant?.name].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t.ticketNumber;
}

function decorate<T extends { title: string | null; problemType: ProblemType | null; plant?: { name: string } | null; department?: { name: string } | null; ticketNumber: string }>(t: T) {
  return { ...t, displayTitle: displayTitle(t) };
}

const MACHINE_SELECT = { id: true, itemCode: true, name: true, category: true, model: true, manufacturer: true, plantLocation: true, powerCapacity: true, status: true } satisfies Prisma.MaintenanceAssetSelect;

/**
 * maintenanceAssetId is a plain cross-schema id (no Prisma relation - see the
 * schema comment on Ticket), so the linked machine's details are joined here
 * at the app layer, batched to avoid an N+1 per ticket in list views.
 */
async function attachMachines<T extends { maintenanceAssetId: string | null }>(items: T[]): Promise<(T & { machine: Prisma.MaintenanceAssetGetPayload<{ select: typeof MACHINE_SELECT }> | null })[]> {
  const ids = [...new Set(items.map((t) => t.maintenanceAssetId).filter((v): v is string => !!v))];
  const machines = ids.length ? await prisma.maintenanceAsset.findMany({ where: { id: { in: ids } }, select: MACHINE_SELECT }) : [];
  const byId = new Map(machines.map((m) => [m.id, m]));
  return items.map((t) => ({ ...t, machine: t.maintenanceAssetId ? (byId.get(t.maintenanceAssetId) ?? null) : null }));
}

/** On hold only applies to the legacy IT boolean-overlay flow; maintenance uses the ON_HOLD status directly. */
function assertNotOnHold(ticket: { onHold: boolean }) {
  if (ticket.onHold) {
    throw new ApiError(400, "This ticket is on hold - resume it first");
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

async function findActiveProductionUsers() {
  return prisma.user.findMany({ where: { role: Role.PRODUCTION, active: true } });
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

  const isMaintenance = input.workstream === Workstream.MAINTENANCE;
  let plant = null;
  let department = null;

  if (isMaintenance) {
    if (!input.plantId) throw new ApiError(400, "Select a plant location");
    if (!input.departmentId) throw new ApiError(400, "Select a department / product category");
    if (!input.problemType) throw new ApiError(400, "Select the type of problem");
    if (!input.machineStatus) throw new ApiError(400, "Select whether the machine is running or stopped");
    if (!input.maintenanceAssetId) throw new ApiError(400, "Select the machine");
    plant = await prisma.plant.findUnique({ where: { id: input.plantId } });
    if (!plant || !plant.active) throw new ApiError(400, "Selected plant is not available");
    department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department || !department.active) throw new ApiError(400, "Selected department is not available");
    const machine = await prisma.maintenanceAsset.findUnique({ where: { id: input.maintenanceAssetId } });
    if (!machine) throw new ApiError(400, "Selected machine is not available");
  } else if (!input.title || input.title.trim().length < 3) {
    throw new ApiError(400, "Title must be at least 3 characters");
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx as typeof prisma, `ticket:${input.workstream}`, 1000);
    const ticketNumber = formatTicketNumber(input.workstream, seq);

    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        workstream: input.workstream,
        category: input.category,
        title: isMaintenance ? null : input.title!.trim(),
        description: input.description,
        itAssetId: isMaintenance ? undefined : input.itAssetId,
        plantId: isMaintenance ? input.plantId : undefined,
        departmentId: isMaintenance ? input.departmentId : undefined,
        problemType: isMaintenance ? input.problemType : undefined,
        machineStatus: isMaintenance ? input.machineStatus : undefined,
        maintenanceAssetId: isMaintenance ? input.maintenanceAssetId : undefined,
        reportedById: actor.id,
        status: TicketStatus.OPEN,
      },
    });

    await tx.ticketStatusHistory.create({
      data: { ticketId: created.id, toStatus: TicketStatus.OPEN, changedById: actor.id, comment: "Ticket raised" },
    });

    await recordAudit(tx, { entityType: "Ticket", entityId: created.id, action: "CREATE", changedById: actor.id, newValue: ticketNumber });

    const label = isMaintenance ? displayTitle({ title: null, problemType: input.problemType ?? null, plant, department, ticketNumber }) : input.title!;
    const managers = await findManagersForWorkstream(input.workstream);
    for (const manager of managers) {
      await notify(tx, manager.id, NotificationType.TICKET_CREATED, `New ${input.workstream} ticket ${ticketNumber} raised: ${label}`, `/tickets/${created.id}`);
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
      plant: true,
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return tickets.map((t) => decorate(withLiveSlaBreach(t, now)));
}

export async function getTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!ticket) throw new ApiError(404, "Ticket not found");
  const [withMachine] = await attachMachines([decorate(withLiveSlaBreach(ticket))]);
  return withMachine;
}

function assertAction(ticket: Ticket, actor: Actor, action: TicketAction) {
  const check = canPerform(action, ticket, actor);
  if (!check.allowed) {
    throw new ApiError(403, check.reason ?? "Action not allowed");
  }
}

// ============================================================ IT workflow ===

export async function assignTicket(actor: Actor, ticketId: string, assignedToId: string, priority: Priority, targetCompletionDate?: string, effortEstimateHours?: number) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "ASSIGN");

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assignedToId } });
  assertValidAssignee(assignee, ticket);
  const targetDate = ticket.workstream === Workstream.IT ? parseFlexibleDate(targetCompletionDate) : undefined;

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

/** Edits assignment details on an IT ticket that's already past OPEN. Maintenance no longer tracks a target date. */
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
  const newTargetDate = ticket.workstream === Workstream.IT && input.targetCompletionDate ? parseFlexibleDate(input.targetCompletionDate) : undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: input.assignedToId ?? undefined,
        managerId: input.assignedToId ? actor.id : undefined,
        targetCompletionDate: ticket.workstream === Workstream.IT && input.targetCompletionDate !== undefined ? (newTargetDate ?? null) : undefined,
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

/** Fast close (IT only now - maintenance uses verifyAndClose). */
export async function closeDirect(actor: Actor, ticketId: string, confirmResolved: boolean, closingComment?: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { attachments: true, comments: true } });
  assertAction(ticket, actor, "DIRECT_CLOSE");
  assertNotOnHold(ticket);

  if (!confirmResolved) {
    throw new ApiError(400, "You must confirm the issue is resolved before closing");
  }
  if (ticket.comments.length === 0 && !closingComment) {
    throw new ApiError(400, "Add a closing comment summarizing the resolution before closing");
  }

  return prisma.$transaction(async (tx) => {
    if (closingComment) {
      await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: closingComment } });
    }
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.CLOSED, closedById: actor.id, closedAt: new Date() } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.CLOSED, changedById: actor.id, comment: "Resolved and closed" } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "CLOSE", changedById: actor.id });
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
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.IN_PROGRESS, closedById: null, closedAt: null } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.IN_PROGRESS, changedById: actor.id, comment: reason } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "REOPEN", changedById: actor.id, newValue: reason });

    const notifyIds = new Set([ticket.assignedToId, ticket.reportedById, ticket.managerId].filter(Boolean) as string[]);
    notifyIds.delete(actor.id);
    for (const userId of notifyIds) {
      await notify(tx, userId, NotificationType.STATUS_CHANGED, `${ticket.ticketNumber} was reopened: ${reason}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function holdTicket(actor: Actor, ticketId: string, detail: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "HOLD");
  if (ticket.onHold) {
    throw new ApiError(400, "This ticket is already on hold");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { onHold: true, onHoldDetail: detail, onHoldSince: new Date() } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "HOLD", changedById: actor.id, newValue: detail });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.ON_HOLD, `${ticket.ticketNumber} put on hold`, `/tickets/${ticketId}`);
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
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { onHold: false, onHoldReason: null, onHoldDetail: null, onHoldSince: null } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "RESUME", changedById: actor.id });
    if (ticket.managerId) {
      await notify(tx, ticket.managerId, NotificationType.RESUMED, `${ticket.ticketNumber} resumed`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

// ===================================================== Maintenance workflow ===

/** Self-assign (Mechanic) or manager-assign; always sets the assignee and ACKNOWLEDGED together. */
export async function acknowledgeTicket(actor: Actor, ticketId: string, assigneeId?: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "ACKNOWLEDGE");

  let targetAssigneeId: string;
  if (actor.role === Role.MECHANIC) {
    if (assigneeId && assigneeId !== actor.id) {
      throw new ApiError(403, "You can only acknowledge and assign this ticket to yourself");
    }
    targetAssigneeId = actor.id;
  } else {
    if (!assigneeId) throw new ApiError(400, "Choose the technician to assign this ticket to");
    targetAssigneeId = assigneeId;
  }
  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: targetAssigneeId } });
  assertValidAssignee(assignee, ticket);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.ACKNOWLEDGED,
        assignedToId: targetAssigneeId,
        managerId: actor.role === Role.MANAGER || actor.role === Role.ADMIN ? actor.id : ticket.managerId,
      },
    });
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.ACKNOWLEDGED, changedById: actor.id, comment: `Acknowledged, assigned to ${assignee.name}` },
    });
    await recordFieldChanges(tx, "Ticket", ticketId, actor.id, { status: ticket.status, assignedToId: ticket.assignedToId }, { status: updated.status, assignedToId: updated.assignedToId });
    if (targetAssigneeId !== actor.id) {
      await notify(tx, targetAssigneeId, NotificationType.TICKET_ASSIGNED, `You were assigned ticket ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
    }
    const managers = await findManagersForWorkstream(ticket.workstream);
    for (const manager of managers) {
      if (manager.id === actor.id) continue;
      await notify(tx, manager.id, NotificationType.STATUS_CHANGED, `${assignee.name} acknowledged ${ticket.ticketNumber}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export interface DelayInput {
  delayReason?: DelayReason;
  delayNotes?: string;
}

function assertValidDelay(input: DelayInput) {
  if (input.delayReason && !input.delayNotes) {
    throw new ApiError(400, "Add a short note explaining the delay");
  }
  if (input.delayNotes && !input.delayReason) {
    throw new ApiError(400, "Choose a reason for the delay");
  }
  if (input.delayNotes && (input.delayNotes.length < 10 || input.delayNotes.length > 300)) {
    throw new ApiError(400, "Delay notes must be between 10 and 300 characters");
  }
}

export async function holdMaintenanceTicket(actor: Actor, ticketId: string, input: DelayInput) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "MAINT_HOLD");
  assertValidDelay(input);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.ON_HOLD, delayReason: input.delayReason ?? null, delayNotes: input.delayNotes ?? null },
    });
    const comment = input.delayReason ? `On hold - ${input.delayReason.replace(/_/g, " ").toLowerCase()}: ${input.delayNotes}` : "On hold";
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.ON_HOLD, changedById: actor.id, comment } });
    const managers = await findManagersForWorkstream(ticket.workstream);
    for (const manager of managers) {
      await notify(tx, manager.id, NotificationType.ON_HOLD, `${ticket.ticketNumber} put on hold`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export async function resumeMaintenanceTicket(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "MAINT_RESUME");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.IN_PROGRESS } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.IN_PROGRESS, changedById: actor.id, comment: "Resumed" } });
    const managers = await findManagersForWorkstream(ticket.workstream);
    for (const manager of managers) {
      await notify(tx, manager.id, NotificationType.RESUMED, `${ticket.ticketNumber} resumed`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export interface ChecklistInput {
  toolsReclaimed: ChecklistAnswer;
  machineCleaned: ChecklistAnswer;
  cableRouting: ChecklistAnswer;
}

const CHECKLIST_VALUES = new Set(Object.values(ChecklistAnswer));

function assertValidChecklist(input: Partial<ChecklistInput>): asserts input is ChecklistInput {
  for (const [key, value] of Object.entries(input)) {
    if (!value || !CHECKLIST_VALUES.has(value as ChecklistAnswer)) {
      throw new ApiError(400, `Answer the post-maintenance checklist (${key}) with Yes, No or N/A before continuing`);
    }
  }
}

/** Ready for Production to verify: requires the 5S post-maintenance checklist. */
export async function markVerificationNeeded(actor: Actor, ticketId: string, checklist: Partial<ChecklistInput>) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "MARK_VERIFICATION_NEEDED");
  assertValidChecklist(checklist);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.VERIFICATION_NEEDED,
        checklistToolsReclaimed: checklist.toolsReclaimed,
        checklistMachineCleaned: checklist.machineCleaned,
        checklistCableRouting: checklist.cableRouting,
      },
    });
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.VERIFICATION_NEEDED, changedById: actor.id, comment: "Ready for production verification" },
    });
    const production = await findActiveProductionUsers();
    for (const user of production) {
      await notify(tx, user.id, NotificationType.VERIFICATION_NEEDED, `${ticket.ticketNumber} needs your verification`, `/tickets/${ticketId}`);
    }
    const managers = await findManagersForWorkstream(ticket.workstream);
    for (const manager of managers) {
      if (production.some((p) => p.id === manager.id)) continue;
      await notify(tx, manager.id, NotificationType.STATUS_CHANGED, `${ticket.ticketNumber} is ready for production verification`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export interface VerifyAndCloseInput {
  qualityRating: QualityRating;
  qualityFeedback?: string;
  certify: boolean;
}

export const PRODUCTION_CERTIFY_STATEMENT = "I certify that the asset/machine has been repaired and is now in safe, workable condition.";

export async function verifyAndClose(actor: Actor, ticketId: string, input: VerifyAndCloseInput) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "VERIFY_AND_CLOSE");
  if (!input.certify) {
    throw new ApiError(400, PRODUCTION_CERTIFY_STATEMENT);
  }
  if (!input.qualityRating) {
    throw new ApiError(400, "Rate the quality of the maintenance resolution before closing");
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.VERIFIED, changedById: actor.id, comment: `Verified - quality: ${input.qualityRating}` },
    });
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        qualityRating: input.qualityRating,
        qualityFeedback: input.qualityFeedback ?? null,
        productionCertified: true,
        productionCertifiedAt: now,
        productionCertifiedById: actor.id,
        closedById: actor.id,
        closedAt: now,
      },
    });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: TicketStatus.VERIFIED, toStatus: TicketStatus.CLOSED, changedById: actor.id, comment: "Verified and closed" } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "VERIFIED_AND_CLOSED", changedById: actor.id, newValue: input.qualityRating });
    const recipients = new Set([ticket.assignedToId, ticket.managerId, ticket.reportedById].filter(Boolean) as string[]);
    recipients.delete(actor.id);
    for (const userId of recipients) {
      await notify(tx, userId, NotificationType.TICKET_CLOSED, `${ticket.ticketNumber} was verified and closed`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

export interface RejectVerificationInput {
  reason: string;
  qualityRating?: QualityRating;
  qualityFeedback?: string;
}

export async function rejectVerification(actor: Actor, ticketId: string, input: RejectVerificationInput) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assertAction(ticket, actor, "REJECT_VERIFICATION");
  if (!input.reason || !input.reason.trim()) {
    throw new ApiError(400, "Explain why the fix is being rejected");
  }

  return prisma.$transaction(async (tx) => {
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: ticket.status, toStatus: TicketStatus.REJECTED, changedById: actor.id, comment: input.reason } });
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.IN_PROGRESS,
        qualityRating: input.qualityRating ?? ticket.qualityRating,
        qualityFeedback: input.qualityFeedback ?? ticket.qualityFeedback,
        // the 5S checklist must be redone once the rework is complete
        checklistToolsReclaimed: null,
        checklistMachineCleaned: null,
        checklistCableRouting: null,
      },
    });
    await tx.ticketComment.create({ data: { ticketId, authorId: actor.id, body: `Verification rejected: ${input.reason}` } });
    await tx.ticketStatusHistory.create({ data: { ticketId, fromStatus: TicketStatus.REJECTED, toStatus: TicketStatus.IN_PROGRESS, changedById: actor.id, comment: "Back with the maintenance team" } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "VERIFICATION_REJECTED", changedById: actor.id, newValue: input.reason });
    const recipients = new Set([ticket.assignedToId, ticket.managerId].filter(Boolean) as string[]);
    recipients.delete(actor.id);
    for (const userId of recipients) {
      await notify(tx, userId, NotificationType.VERIFICATION_REJECTED, `${ticket.ticketNumber} verification rejected: ${input.reason}`, `/tickets/${ticketId}`);
    }
    return updated;
  });
}

// ========================================================== shared actions ===

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
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketCostEntry.create({ data: { ticketId, description, amount, sparePartUsed } });
    const agg = await tx.ticketCostEntry.aggregate({ where: { ticketId }, _sum: { amount: true } });
    await tx.ticket.update({ where: { id: ticketId }, data: { actualCost: agg._sum.amount ?? 0 } });
    await recordAudit(tx, { entityType: "Ticket", entityId: ticketId, action: "COST_ENTRY_ADDED", changedById: actor.id, newValue: `${description}: ${amount}` });
    return created;
  });
  return entry;
}
