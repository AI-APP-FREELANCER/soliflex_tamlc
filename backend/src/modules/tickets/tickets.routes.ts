import { Router } from "express";
import { z } from "zod";
import { AttachmentType, OnHoldReason, Priority, TicketCategory, TicketStatus, Workstream } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { Role } from "@prisma/client";
import * as tickets from "./tickets.service";

const router = Router();
router.use(requireAuth);

function actorFromReq(req: Express.Request | any) {
  return { id: req.user.sub, role: req.user.role, workstream: req.user.workstream, name: req.user.name };
}

router.get("/", async (req, res) => {
  const result = await tickets.listTickets({
    workstream: req.query.workstream as Workstream | undefined,
    status: req.query.status as TicketStatus | undefined,
    assignedToId: req.query.assignedToId as string | undefined,
    reportedById: req.query.reportedById as string | undefined,
    priority: req.query.priority as Priority | undefined,
    onHold: req.query.onHold ? req.query.onHold === "true" : undefined,
    search: req.query.search as string | undefined,
  });
  res.json(result);
});

router.get("/:id", async (req, res) => {
  res.json(await tickets.getTicket(req.params.id));
});

const createSchema = z.object({
  workstream: z.nativeEnum(Workstream),
  category: z.nativeEnum(TicketCategory),
  title: z.string().min(3),
  description: z.string().min(3),
  plantLocation: z.string().optional(),
  maintenanceAssetId: z.string().optional(),
  itAssetId: z.string().optional(),
});

router.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const ticket = await tickets.createTicket(actorFromReq(req), data);
  res.status(201).json(ticket);
});

const assignSchema = z.object({
  assignedToId: z.string(),
  priority: z.nativeEnum(Priority),
  targetCompletionDate: z.string().optional(),
  effortEstimateHours: z.number().optional(),
});

router.post("/:id/assign", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = assignSchema.parse(req.body);
  const ticket = await tickets.assignTicket(actorFromReq(req), req.params.id, data.assignedToId, data.priority, data.targetCompletionDate, data.effortEstimateHours);
  res.json(ticket);
});

const priorityUpdateSchema = z.object({ priority: z.nativeEnum(Priority) });
router.patch("/:id/priority", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = priorityUpdateSchema.parse(req.body);
  res.json(await tickets.updatePriority(actorFromReq(req), req.params.id, data.priority));
});

router.post("/:id/start-progress", async (req, res) => {
  res.json(await tickets.startProgress(actorFromReq(req), req.params.id));
});

const recommendationSchema = z.object({ diagnosis: z.string().min(1), recommendedFix: z.string().min(1) });
router.post("/:id/submit-recommendation", async (req, res) => {
  const data = recommendationSchema.parse(req.body);
  res.json(await tickets.submitRecommendation(actorFromReq(req), req.params.id, data.diagnosis, data.recommendedFix));
});

const decisionSchema = z.object({ approve: z.boolean(), comment: z.string().optional() });
router.post("/:id/decide-recommendation", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = decisionSchema.parse(req.body);
  res.json(await tickets.decideRecommendation(actorFromReq(req), req.params.id, data.approve, data.comment));
});

router.post("/:id/mark-first-line-review", async (req, res) => {
  res.json(await tickets.markFirstLineReview(actorFromReq(req), req.params.id));
});

router.post("/:id/mark-job-completed", async (req, res) => {
  res.json(await tickets.markJobCompleted(actorFromReq(req), req.params.id));
});

router.post("/:id/mark-final-review", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  res.json(await tickets.markFinalReview(actorFromReq(req), req.params.id));
});

const closeSchema = z.object({ confirmEquipmentOperational: z.boolean(), closingComment: z.string().optional() });
router.post("/:id/close", requireRole(Role.MANAGER, Role.ADMIN), async (req, res) => {
  const data = closeSchema.parse(req.body);
  res.json(await tickets.closeTicket(actorFromReq(req), req.params.id, data.confirmEquipmentOperational, data.closingComment));
});

const holdSchema = z.object({ reason: z.nativeEnum(OnHoldReason), detail: z.string().min(1) });
router.post("/:id/hold", async (req, res) => {
  const data = holdSchema.parse(req.body);
  res.json(await tickets.holdTicket(actorFromReq(req), req.params.id, data.reason, data.detail));
});

router.post("/:id/resume", async (req, res) => {
  res.json(await tickets.resumeTicket(actorFromReq(req), req.params.id));
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
