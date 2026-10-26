import { Router } from "express";
import { z } from "zod";
import { AttachmentType, ChecklistAnswer, DelayReason, MachineStatus, Priority, ProblemType, QualityRating, TicketCategory, TicketStatus, Workstream } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { LEGACY_ROLES } from "../../lib/roles";
import { upload } from "../../middleware/upload";
import { Role } from "@prisma/client";
import * as tickets from "./tickets.service";
import { resolveDateRange } from "../../lib/date-range";
import { prisma } from "../../lib/prisma";
import { workstreamScope } from "../../lib/workstream-scope";
import { ApiError } from "../../middleware/errors";

const router = Router();
// Maintenance/IT board data is for board roles only (helpdesk-only roles use /api/helpdesk).
router.use(requireAuth, requireRole(...LEGACY_ROLES));

function actorFromReq(req: Express.Request | any) {
  return { id: req.user.sub, role: req.user.role, workstream: req.user.workstream, name: req.user.name };
}

// Maintenance and IT are separate workflows: a user only reaches their own
// workstream's tickets. Out-of-scope tickets look like they do not exist.
router.param("id", async (req, _res, next, id) => {
  try {
    const scope = workstreamScope({ role: req.user!.role as Role, workstream: (req.user!.workstream ?? null) as Workstream | null });
    if (scope) {
      const t = await prisma.ticket.findUnique({ where: { id }, select: { workstream: true } });
      if (t && t.workstream !== scope) throw new ApiError(404, "Ticket not found");
    }
    next();
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res) => {
  const scope = workstreamScope({ role: req.user!.role as Role, workstream: (req.user!.workstream ?? null) as Workstream | null });
  const result = await tickets.listTickets({
    workstream: scope ?? (req.query.workstream as Workstream | undefined),
    status: req.query.status as TicketStatus | undefined,
    assignedToId: req.query.assignedToId as string | undefined,
    reportedById: req.query.reportedById as string | undefined,
    priority: req.query.priority as Priority | undefined,
    onHold: req.query.onHold ? req.query.onHold === "true" : undefined,
    search: req.query.search as string | undefined,
    createdAtRange: resolveDateRange({
      range: req.query.range as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    }),
  });
  res.json(result);
});

router.get("/:id", async (req, res) => {
  res.json(await tickets.getTicket(req.params.id));
});

const createSchema = z.object({
  workstream: z.nativeEnum(Workstream),
  category: z.nativeEnum(TicketCategory),
  // IT only; validated server-side as required for IT, unused for Maintenance.
  title: z.string().optional(),
  description: z.string().min(3),
  plantId: z.string().optional(),
  departmentId: z.string().optional(),
  problemType: z.nativeEnum(ProblemType).optional(),
  machineStatus: z.nativeEnum(MachineStatus).optional(),
  maintenanceAssetId: z.string().optional(),
  itAssetId: z.string().optional(),
});

router.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const ticket = await tickets.createTicket(actorFromReq(req), data);
  res.status(201).json(ticket);
});

// --------------------------------------------------------------- IT only ---

const assignSchema = z.object({
  assignedToId: z.string(),
  priority: z.nativeEnum(Priority),
  targetCompletionDate: z.string().optional(),
  effortEstimateHours: z.number().min(0).optional(),
});

router.post("/:id/assign", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = assignSchema.parse(req.body);
  const ticket = await tickets.assignTicket(actorFromReq(req), req.params.id, data.assignedToId, data.priority, data.targetCompletionDate, data.effortEstimateHours);
  res.json(ticket);
});

const updateAssignmentSchema = z.object({
  assignedToId: z.string().optional(),
  targetCompletionDate: z.string().nullable().optional(),
  effortEstimateHours: z.number().min(0).optional(),
});
router.patch("/:id/assignment", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = updateAssignmentSchema.parse(req.body);
  res.json(await tickets.updateAssignment(actorFromReq(req), req.params.id, data));
});

router.post("/:id/close-direct", async (req, res) => {
  const data = z.object({ confirmEquipmentOperational: z.boolean(), closingComment: z.string().optional() }).parse(req.body);
  res.json(await tickets.closeDirect(actorFromReq(req), req.params.id, data.confirmEquipmentOperational, data.closingComment));
});

const reopenSchema = z.object({ reason: z.string().min(1) });
// Reopening un-closes a ticket - Admin has full powers everywhere else, but not this one.
router.post("/:id/reopen", requireRole(Role.MANAGER), async (req, res) => {
  const data = reopenSchema.parse(req.body);
  res.json(await tickets.reopenTicket(actorFromReq(req), req.params.id, data.reason));
});

const holdSchema = z.object({ detail: z.string().min(1) });
router.post("/:id/hold", async (req, res) => {
  const data = holdSchema.parse(req.body);
  res.json(await tickets.holdTicket(actorFromReq(req), req.params.id, data.detail));
});

router.post("/:id/resume", async (req, res) => {
  res.json(await tickets.resumeTicket(actorFromReq(req), req.params.id));
});

// --------------------------------------------------------- Maintenance only ---

const acknowledgeSchema = z.object({ assigneeId: z.string().optional() });
router.post("/:id/acknowledge", async (req, res) => {
  const data = acknowledgeSchema.parse(req.body);
  res.json(await tickets.acknowledgeTicket(actorFromReq(req), req.params.id, data.assigneeId));
});

const maintHoldSchema = z.object({ delayReason: z.nativeEnum(DelayReason).optional(), delayNotes: z.string().min(10).max(300).optional() });
router.post("/:id/maint-hold", async (req, res) => {
  const data = maintHoldSchema.parse(req.body);
  res.json(await tickets.holdMaintenanceTicket(actorFromReq(req), req.params.id, data));
});

router.post("/:id/maint-resume", async (req, res) => {
  res.json(await tickets.resumeMaintenanceTicket(actorFromReq(req), req.params.id));
});

const checklistSchema = z.object({
  toolsReclaimed: z.nativeEnum(ChecklistAnswer),
  machineCleaned: z.nativeEnum(ChecklistAnswer),
  cableRouting: z.nativeEnum(ChecklistAnswer),
});
router.post("/:id/mark-verification-needed", async (req, res) => {
  const data = checklistSchema.parse(req.body);
  res.json(await tickets.markVerificationNeeded(actorFromReq(req), req.params.id, data));
});

const verifyAndCloseSchema = z.object({
  qualityRating: z.nativeEnum(QualityRating),
  qualityFeedback: z.string().optional(),
  certify: z.literal(true),
});
router.post("/:id/verify-and-close", requireRole(Role.MANAGER, Role.ADMIN, Role.PRODUCTION), async (req, res) => {
  const data = verifyAndCloseSchema.parse(req.body);
  res.json(await tickets.verifyAndClose(actorFromReq(req), req.params.id, data));
});

const rejectVerificationSchema = z.object({
  reason: z.string().min(1),
  qualityRating: z.nativeEnum(QualityRating).optional(),
  qualityFeedback: z.string().optional(),
});
router.post("/:id/reject-verification", requireRole(Role.MANAGER, Role.ADMIN, Role.PRODUCTION), async (req, res) => {
  const data = rejectVerificationSchema.parse(req.body);
  res.json(await tickets.rejectVerification(actorFromReq(req), req.params.id, data));
});

// -------------------------------------------------------------- shared ---

router.post("/:id/start-progress", async (req, res) => {
  res.json(await tickets.startProgress(actorFromReq(req), req.params.id));
});

const priorityUpdateSchema = z.object({ priority: z.nativeEnum(Priority) });
router.patch("/:id/priority", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = priorityUpdateSchema.parse(req.body);
  res.json(await tickets.updatePriority(actorFromReq(req), req.params.id, data.priority));
});

const commentSchema = z.object({ body: z.string().min(1) });
router.post("/:id/comments", async (req, res) => {
  const data = commentSchema.parse(req.body);
  res.status(201).json(await tickets.addComment(actorFromReq(req), req.params.id, data.body));
});

router.post("/:id/attachments", upload.single("file"), async (req, res) => {
  const type = req.body.type as AttachmentType;
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const attachment = await tickets.addAttachment(actorFromReq(req), req.params.id, req.file, type);
  res.status(201).json(attachment);
});

const costSchema = z.object({ description: z.string().min(1), amount: z.number().positive(), sparePartUsed: z.boolean().optional() });
router.post("/:id/costs", async (req, res) => {
  const data = costSchema.parse(req.body);
  res.status(201).json(await tickets.addCostEntry(actorFromReq(req), req.params.id, data.description, data.amount, data.sparePartUsed ?? false));
});

export default router;
