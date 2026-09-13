import { api } from "../../lib/api";
import type { AttachmentType, OnHoldReason, Priority, Ticket, TicketCategory, TicketStatus, Workstream } from "../../lib/types";
import type { DateRangeValue } from "../../components/DateRangeFilter";

export interface TicketFilter extends DateRangeValue {
  workstream?: Workstream;
  status?: TicketStatus;
  assignedToId?: string;
  priority?: Priority;
  onHold?: boolean;
  search?: string;
}

export async function fetchTickets(filter: TicketFilter): Promise<Ticket[]> {
  const res = await api.get("/tickets", { params: filter });
  return res.data;
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const res = await api.get(`/tickets/${id}`);
  return res.data;
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

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const res = await api.post("/tickets", input);
  return res.data;
}

export async function assignTicket(id: string, data: { assignedToId: string; priority: Priority; targetCompletionDate?: string; effortEstimateHours?: number }) {
  const res = await api.post(`/tickets/${id}/assign`, data);
  return res.data;
}

export async function updateAssignment(id: string, data: { assignedToId?: string; targetCompletionDate?: string | null; effortEstimateHours?: number }) {
  const res = await api.patch(`/tickets/${id}/assignment`, data);
  return res.data;
}

export async function updatePriority(id: string, priority: Priority) {
  const res = await api.patch(`/tickets/${id}/priority`, { priority });
  return res.data;
}

export async function startProgress(id: string) {
  const res = await api.post(`/tickets/${id}/start-progress`);
  return res.data;
}

export async function submitRecommendation(id: string, data: { diagnosis: string; recommendedFix: string }) {
  const res = await api.post(`/tickets/${id}/submit-recommendation`, data);
  return res.data;
}

export async function decideRecommendation(id: string, data: { approve: boolean; comment?: string }) {
  const res = await api.post(`/tickets/${id}/decide-recommendation`, data);
  return res.data;
}

export async function markFirstLineReview(id: string) {
  const res = await api.post(`/tickets/${id}/mark-first-line-review`);
  return res.data;
}

export async function markJobCompleted(id: string) {
  const res = await api.post(`/tickets/${id}/mark-job-completed`);
  return res.data;
}

export async function markFinalReview(id: string) {
  const res = await api.post(`/tickets/${id}/mark-final-review`);
  return res.data;
}

export async function closeTicket(id: string, data: { confirmEquipmentOperational: boolean; closingComment?: string }) {
  const res = await api.post(`/tickets/${id}/close`, data);
  return res.data;
}

export async function holdTicket(id: string, data: { reason: OnHoldReason; detail: string }) {
  const res = await api.post(`/tickets/${id}/hold`, data);
  return res.data;
}

export async function resumeTicket(id: string) {
  const res = await api.post(`/tickets/${id}/resume`);
  return res.data;
}

export async function addComment(id: string, body: string) {
  const res = await api.post(`/tickets/${id}/comments`, { body });
  return res.data;
}

export async function addAttachment(id: string, file: File, type: AttachmentType) {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  const res = await api.post(`/tickets/${id}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export async function addCostEntry(id: string, data: { description: string; amount: number; sparePartUsed?: boolean }) {
  const res = await api.post(`/tickets/${id}/costs`, data);
  return res.data;
}
