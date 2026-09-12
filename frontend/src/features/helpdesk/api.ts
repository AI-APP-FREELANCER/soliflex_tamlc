import { api } from "../../lib/api";
import type { HelpdeskCategory, HelpdeskDashboardStats, HelpdeskStatus, HelpdeskTicket, Priority } from "../../lib/types";
import type { DateRangeValue } from "../../components/DateRangeFilter";

export interface HelpdeskFilter extends DateRangeValue {
  status?: HelpdeskStatus;
  category?: HelpdeskCategory;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
  missingDeadline?: boolean;
}

export async function fetchHelpdeskTickets(filter: HelpdeskFilter): Promise<HelpdeskTicket[]> {
  const res = await api.get("/helpdesk", { params: filter });
  return res.data;
}

export async function fetchHelpdeskTicket(id: string): Promise<HelpdeskTicket> {
  const res = await api.get(`/helpdesk/${id}`);
  return res.data;
}

export interface CreateHelpdeskTicketInput {
  category: HelpdeskCategory;
  title: string;
  description: string;
  itAssetId?: string;
}

export async function createHelpdeskTicket(input: CreateHelpdeskTicketInput): Promise<HelpdeskTicket> {
  const res = await api.post("/helpdesk", input);
  return res.data;
}

export async function assignHelpdeskTicket(id: string, data: { assignedToId: string; deadline: string; priority?: Priority }) {
  const res = await api.post(`/helpdesk/${id}/assign`, data);
  return res.data;
}

export async function updateHelpdeskDeadline(id: string, deadline: string) {
  const res = await api.patch(`/helpdesk/${id}/deadline`, { deadline });
  return res.data;
}

export async function startHelpdeskProgress(id: string) {
  const res = await api.post(`/helpdesk/${id}/start-progress`);
  return res.data;
}

export async function holdHelpdeskTicket(id: string, detail: string) {
  const res = await api.post(`/helpdesk/${id}/hold`, { detail });
  return res.data;
}

export async function resumeHelpdeskTicket(id: string) {
  const res = await api.post(`/helpdesk/${id}/resume`);
  return res.data;
}

export async function resolveHelpdeskTicket(id: string, resolutionComment?: string) {
  const res = await api.post(`/helpdesk/${id}/resolve`, { resolutionComment });
  return res.data;
}

export async function reopenHelpdeskTicket(id: string, reason: string) {
  const res = await api.post(`/helpdesk/${id}/reopen`, { reason });
  return res.data;
}

export async function closeHelpdeskTicket(id: string) {
  const res = await api.post(`/helpdesk/${id}/close`);
  return res.data;
}

export async function addHelpdeskComment(id: string, body: string) {
  const res = await api.post(`/helpdesk/${id}/comments`, { body });
  return res.data;
}

export async function fetchHelpdeskDashboardStats(dateRange: DateRangeValue): Promise<HelpdeskDashboardStats> {
  const res = await api.get("/helpdesk/dashboard/stats", { params: dateRange });
  return res.data;
}
