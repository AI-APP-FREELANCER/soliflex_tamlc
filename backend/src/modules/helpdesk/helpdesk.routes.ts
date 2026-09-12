import { Router } from "express";
import { z } from "zod";
import { HelpdeskCategory, HelpdeskStatus, Priority, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as helpdesk from "./helpdesk.service";

const router = Router();
router.use(requireAuth);

function actorFromReq(req: Express.Request | any): helpdesk.Actor {
  return { id: req.user.sub, role: req.user.role, name: req.user.name };
}

router.get("/dashboard/stats", requireRole(Role.IT_TEAM_LEAD, Role.ADMIN), async (req, res) => {
  const stats = await helpdesk.getHelpdeskDashboardStats({
    range: req.query.range as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  res.json(stats);
});

router.get("/", async (req, res) => {
  const result = await helpdesk.listHelpdeskTickets(
    {
      status: req.query.status as HelpdeskStatus | undefined,
      category: req.query.category as HelpdeskCategory | undefined,
      priority: req.query.priority as Priority | undefined,
      assignedToId: req.query.assignedToId as string | undefined,
      search: req.query.search as string | undefined,
      missingDeadline: req.query.missingDeadline === "true",
      range: req.query.range as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    },
    actorFromReq(req)
  );
  res.json(result);
});

router.get("/:id", async (req, res) => {
  res.json(await helpdesk.getHelpdeskTicket(req.params.id, actorFromReq(req)));
});

const createSchema = z.object({
  category: z.nativeEnum(HelpdeskCategory),
  title: z.string().min(3),
  description: z.string().min(3),
  itAssetId: z.string().optional(),
});

router.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const ticket = await helpdesk.createHelpdeskTicket(actorFromReq(req), data);
  res.status(201).json(ticket);
});

const assignSchema = z.object({
  assignedToId: z.string(),
  deadline: z.string().min(1),
  priority: z.nativeEnum(Priority).optional(),
});

router.post("/:id/assign", requireRole(Role.IT_TEAM_LEAD, Role.ADMIN), async (req, res) => {
  const data = assignSchema.parse(req.body);
  const ticket = await helpdesk.assignHelpdeskTicket(actorFromReq(req), req.params.id, data.assignedToId, data.deadline, data.priority);
  res.json(ticket);
});

const deadlineSchema = z.object({ deadline: z.string().min(1) });
router.patch("/:id/deadline", requireRole(Role.IT_TEAM_LEAD, Role.ADMIN), async (req, res) => {
  const data = deadlineSchema.parse(req.body);
  res.json(await helpdesk.updateDeadline(actorFromReq(req), req.params.id, data.deadline));
});

router.post("/:id/start-progress", async (req, res) => {
  res.json(await helpdesk.startProgress(actorFromReq(req), req.params.id));
});

const holdSchema = z.object({ detail: z.string().min(1) });
router.post("/:id/hold", async (req, res) => {
  const data = holdSchema.parse(req.body);
  res.json(await helpdesk.holdTicket(actorFromReq(req), req.params.id, data.detail));
});

router.post("/:id/resume", async (req, res) => {
  res.json(await helpdesk.resumeTicket(actorFromReq(req), req.params.id));
});

const resolveSchema = z.object({ resolutionComment: z.string().optional() });
router.post("/:id/resolve", async (req, res) => {
  const data = resolveSchema.parse(req.body);
  res.json(await helpdesk.resolveTicket(actorFromReq(req), req.params.id, data.resolutionComment));
});

const reopenSchema = z.object({ reason: z.string().min(1) });
router.post("/:id/reopen", async (req, res) => {
  const data = reopenSchema.parse(req.body);
  res.json(await helpdesk.reopenTicket(actorFromReq(req), req.params.id, data.reason));
});

router.post("/:id/close", requireRole(Role.IT_TEAM_LEAD, Role.ADMIN), async (req, res) => {
  res.json(await helpdesk.closeTicket(actorFromReq(req), req.params.id));
});

const commentSchema = z.object({ body: z.string().min(1) });
router.post("/:id/comments", async (req, res) => {
  const data = commentSchema.parse(req.body);
  res.status(201).json(await helpdesk.addComment(actorFromReq(req), req.params.id, data.body));
});

export default router;
