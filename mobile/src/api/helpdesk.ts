import { api } from "@/lib/api-client";
import type { HelpdeskDashboardStats, HelpdeskFilter, HelpdeskTicket, Priority } from "@/lib/types";

function filterParams(filter: HelpdeskFilter) {
  return {
    status: filter.status,
    category: filter.category,
    priority: filter.priority,
    assignedToId: filter.assignedToId,
    search: filter.search || undefined,
    missingDeadline: filter.missingDeadline ? "true" : undefined,
    range: filter.range,
    from: filter.from,
    to: filter.to,
  };
}

export async function fetchHelpdeskTickets(filter: HelpdeskFilter): Promise<HelpdeskTicket[]> {
  const res = await api.get("/helpdesk", { params: filterParams(filter) });
  return res.data;
}

export async function fetchHelpdeskTicket(id: string): Promise<HelpdeskTicket> {
  const res = await api.get(`/helpdesk/${id}`);
  return res.data;
}

export async function fetchHelpdeskDashboardStats(range: HelpdeskFilter): Promise<HelpdeskDashboardStats> {
  const res = await api.get("/helpdesk/dashboard/stats", {
    params: { range: range.range, from: range.from, to: range.to },
  });
  return res.data;
}

export interface CreateHelpdeskTicketInput {
  category: HelpdeskTicket["category"];
  title: string;
  description: string;
  itAssetId?: string;
}

export async function createHelpdeskTicket(input: CreateHelpdeskTicketInput): Promise<HelpdeskTicket> {
  const res = await api.post("/helpdesk", input);
  return res.data;
}

export interface AssignHelpdeskInput {
  assignedToId: string;
  deadline: string;
  priority?: Priority;
}

export async function assignHelpdeskTicket(id: string, input: AssignHelpdeskInput): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/assign`, input);
  return res.data;
}

export async function updateHelpdeskDeadline(id: string, deadline: string): Promise<HelpdeskTicket> {
  const res = await api.patch(`/helpdesk/${id}/deadline`, { deadline });
  return res.data;
}

export async function startHelpdeskProgress(id: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/start-progress`);
  return res.data;
}

export async function holdHelpdeskTicket(id: string, detail: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/hold`, { detail });
  return res.data;
}

export async function resumeHelpdeskTicket(id: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/resume`);
  return res.data;
}

export async function resolveHelpdeskTicket(id: string, resolutionComment?: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/resolve`, resolutionComment ? { resolutionComment } : {});
  return res.data;
}

export async function reopenHelpdeskTicket(id: string, reason: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/reopen`, { reason });
  return res.data;
}

export async function closeHelpdeskTicket(id: string): Promise<HelpdeskTicket> {
  const res = await api.post(`/helpdesk/${id}/close`);
  return res.data;
}

export async function addHelpdeskComment(id: string, body: string): Promise<void> {
  await api.post(`/helpdesk/${id}/comments`, { body });
}
