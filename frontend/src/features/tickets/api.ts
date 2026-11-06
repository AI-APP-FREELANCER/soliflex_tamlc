import { api } from "../../lib/api";
import type {
  AttachmentType,
  ChecklistAnswer,
  DelayReason,
  MachineStatus,
  Priority,
  ProblemType,
  QualityRating,
  Ticket,
  TicketCategory,
  TicketStatus,
  Workstream,
} from "../../lib/types";
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
  /** IT only; maintenance no longer collects a category - every maintenance ticket is categorized server-side. */
  category?: TicketCategory;
  /** IT only; maintenance no longer collects a title. */
  title?: string;
  description: string;
  /** Mandatory. CRITICAL is retired - LOW/MEDIUM/HIGH only. */
  priority: Exclude<Priority, "CRITICAL">;
  plantId?: string;
  departmentId?: string;
  problemType?: ProblemType;
  machineStatus?: MachineStatus;
  maintenanceAssetId?: string;
  itAssetId?: string;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const res = await api.post("/tickets", input);
  return res.data;
}

// --------------------------------------------------------------- IT only ---

export async function assignTicket(id: string, data: { assignedToId: string; priority: Priority; note: string; targetCompletionDate?: string; effortEstimateHours?: number }) {
  const res = await api.post(`/tickets/${id}/assign`, data);
  return res.data;
}

export async function updateAssignment(id: string, data: { assignedToId?: string; targetCompletionDate?: string | null; effortEstimateHours?: number }) {
  const res = await api.patch(`/tickets/${id}/assignment`, data);
  return res.data;
}

/** Engineer / manager fast close (IT only - maintenance uses verifyAndClose). */
export async function closeTicketDirect(id: string, data: { confirmEquipmentOperational: boolean; closingComment: string }) {
  const res = await api.post(`/tickets/${id}/close-direct`, data);
  return res.data;
}

export async function reopenTicket(id: string, reason: string) {
  const res = await api.post(`/tickets/${id}/reopen`, { reason });
  return res.data;
}

export async function holdTicket(id: string, detail: string) {
  const res = await api.post(`/tickets/${id}/hold`, { detail });
  return res.data;
}

export async function resumeTicket(id: string, note: string) {
  const res = await api.post(`/tickets/${id}/resume`, { note });
  return res.data;
}

// --------------------------------------------------------- Maintenance only ---

/** Self-assign (Mechanic) or manager-assign; always sets the assignee and ACKNOWLEDGED together. */
export async function acknowledgeTicket(id: string, note: string, assigneeId?: string) {
  const res = await api.post(`/tickets/${id}/acknowledge`, { note, assigneeId });
  return res.data;
}

export async function holdMaintenanceTicket(id: string, data: { delayReason: DelayReason; delayNotes: string }) {
  const res = await api.post(`/tickets/${id}/maint-hold`, data);
  return res.data;
}

export async function resumeMaintenanceTicket(id: string, note: string) {
  const res = await api.post(`/tickets/${id}/maint-resume`, { note });
  return res.data;
}

export interface ChecklistInput {
  toolsReclaimed: ChecklistAnswer;
  machineCleaned: ChecklistAnswer;
  cableRouting: ChecklistAnswer;
}

export async function markVerificationNeeded(id: string, data: ChecklistInput & { note: string }) {
  const res = await api.post(`/tickets/${id}/mark-verification-needed`, data);
  return res.data;
}

export async function verifyAndClose(id: string, data: { qualityRating: QualityRating; qualityFeedback: string; certify: true }) {
  const res = await api.post(`/tickets/${id}/verify-and-close`, data);
  return res.data;
}

export async function rejectVerification(id: string, data: { reason: string; qualityRating?: QualityRating; qualityFeedback?: string }) {
  const res = await api.post(`/tickets/${id}/reject-verification`, data);
  return res.data;
}

// -------------------------------------------------------------- shared ---

export async function startProgress(id: string, note: string) {
  const res = await api.post(`/tickets/${id}/start-progress`, { note });
  return res.data;
}

export async function updatePriority(id: string, priority: Priority) {
  const res = await api.patch(`/tickets/${id}/priority`, { priority });
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
