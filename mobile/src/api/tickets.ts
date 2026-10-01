import { api } from "@/lib/api-client";
import type { AttachmentType, Priority, Ticket, TicketCategory, TicketFilter, Workstream } from "@/lib/types";

export async function fetchTickets(filter: TicketFilter): Promise<Ticket[]> {
  const res = await api.get("/tickets", {
    params: {
      workstream: filter.workstream,
      status: filter.status,
      assignedToId: filter.assignedToId,
      reportedById: filter.reportedById,
      priority: filter.priority,
      onHold: filter.onHold ? "true" : undefined,
      search: filter.search || undefined,
      range: filter.range,
      from: filter.from,
      to: filter.to,
    },
  });
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

export interface AssignTicketInput {
  assignedToId: string;
  priority: Priority;
  targetCompletionDate?: string;
  effortEstimateHours?: number;
}

export async function assignTicket(id: string, input: AssignTicketInput): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/assign`, input);
  return res.data;
}

export interface UpdateAssignmentInput {
  assignedToId?: string;
  targetCompletionDate?: string | null;
  effortEstimateHours?: number;
}

export async function updateTicketAssignment(id: string, input: UpdateAssignmentInput): Promise<Ticket> {
  const res = await api.patch(`/tickets/${id}/assignment`, input);
  return res.data;
}

export async function updateTicketPriority(id: string, priority: Priority): Promise<Ticket> {
  const res = await api.patch(`/tickets/${id}/priority`, { priority });
  return res.data;
}

export async function startTicketProgress(id: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/start-progress`);
  return res.data;
}

export async function submitRecommendation(id: string, diagnosis: string, recommendedFix: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/submit-recommendation`, { diagnosis, recommendedFix });
  return res.data;
}

export async function decideRecommendation(id: string, approve: boolean, comment?: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/decide-recommendation`, { approve, comment });
  return res.data;
}

export async function markFirstLineReview(id: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/mark-first-line-review`);
  return res.data;
}

export async function markJobCompleted(id: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/mark-job-completed`);
  return res.data;
}

export async function markFinalReview(id: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/mark-final-review`);
  return res.data;
}

export async function closeTicket(id: string, confirmEquipmentOperational: boolean, closingComment?: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/close`, { confirmEquipmentOperational, closingComment });
  return res.data;
}

export async function reopenTicket(id: string, reason: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/reopen`, { reason });
  return res.data;
}

export async function holdTicket(id: string, reason: string, detail: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/hold`, { reason, detail });
  return res.data;
}

export async function resumeTicket(id: string): Promise<Ticket> {
  const res = await api.post(`/tickets/${id}/resume`);
  return res.data;
}

export async function addTicketComment(id: string, body: string): Promise<void> {
  await api.post(`/tickets/${id}/comments`, { body });
}

export async function uploadTicketAttachment(id: string, uri: string, fileName: string, mimeType: string, type: AttachmentType): Promise<void> {
  const form = new FormData();
  // RN FormData file shape — not a real Blob, but this is what the fetch/axios
  // polyfill on both platforms expects for a file picked via expo-image-picker.
  form.append("file", { uri, name: fileName, type: mimeType } as unknown as Blob);
  form.append("type", type);
  await api.post(`/tickets/${id}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function addTicketCost(id: string, description: string, amount: number, sparePartUsed?: boolean): Promise<void> {
  await api.post(`/tickets/${id}/costs`, { description, amount, sparePartUsed });
}
