import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-client";
import type { AttachmentType, Priority, TicketFilter } from "@/lib/types";
import {
  acknowledgeTicket,
  addTicketComment,
  addTicketCost,
  assignTicket,
  closeTicketDirect,
  createTicket,
  fetchTicket,
  fetchTickets,
  holdMaintenanceTicket,
  holdTicket,
  markVerificationNeeded,
  rejectVerification,
  reopenTicket,
  resumeMaintenanceTicket,
  resumeTicket,
  startTicketProgress,
  updateTicketAssignment,
  updateTicketPriority,
  uploadTicketAttachment,
  verifyAndClose,
  type AssignTicketInput,
  type ChecklistInput,
  type CreateTicketInput,
  type UpdateAssignmentInput,
} from "@/api/tickets";

export function useTickets(filter: TicketFilter) {
  return useQuery({ queryKey: ["tickets", filter], queryFn: () => fetchTickets(filter) });
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: ["ticket", id], queryFn: () => fetchTicket(id as string), enabled: !!id });
}

function onErr(err: unknown) {
  Alert.alert("Something went wrong", apiErrorMessage(err));
}

export function useTicketMutations(ticketId?: string) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["reports-dashboard"] });
    qc.invalidateQueries({ queryKey: ["reports-overdue"] });
    qc.invalidateQueries({ queryKey: ["maintenance-analytics"] });
    if (ticketId) qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
  }

  const create = useMutation({ mutationFn: (input: CreateTicketInput) => createTicket(input), onError: onErr });

  // IT only
  const assign = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignTicketInput }) => assignTicket(id, input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const updateAssignment = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssignmentInput }) => updateTicketAssignment(id, input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const closeDirect = useMutation({
    mutationFn: ({ id, confirmEquipmentOperational, closingComment }: { id: string; confirmEquipmentOperational: boolean; closingComment?: string }) =>
      closeTicketDirect(id, confirmEquipmentOperational, closingComment),
    onSuccess: invalidate,
    onError: onErr,
  });

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reopenTicket(id, reason),
    onSuccess: invalidate,
    onError: onErr,
  });

  const hold = useMutation({
    mutationFn: ({ id, detail }: { id: string; detail: string }) => holdTicket(id, detail),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resume = useMutation({
    mutationFn: (id: string) => resumeTicket(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  // maintenance only
  const acknowledge = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId?: string }) => acknowledgeTicket(id, assigneeId),
    onSuccess: invalidate,
    onError: onErr,
  });

  const maintHold = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof holdMaintenanceTicket>[1] }) => holdMaintenanceTicket(id, data),
    onSuccess: invalidate,
    onError: onErr,
  });

  const maintResume = useMutation({
    mutationFn: (id: string) => resumeMaintenanceTicket(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const markVerificationNeededM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChecklistInput }) => markVerificationNeeded(id, data),
    onSuccess: invalidate,
    onError: onErr,
  });

  const verifyAndCloseM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof verifyAndClose>[1] }) => verifyAndClose(id, data),
    onSuccess: invalidate,
    onError: onErr,
  });

  const rejectVerificationM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof rejectVerification>[1] }) => rejectVerification(id, data),
    onSuccess: invalidate,
    onError: onErr,
  });

  // shared
  const startProgress = useMutation({
    mutationFn: (id: string) => startTicketProgress(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const updatePriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Priority }) => updateTicketPriority(id, priority),
    onSuccess: invalidate,
    onError: onErr,
  });

  const addComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => addTicketComment(id, body),
    onSuccess: invalidate,
    onError: onErr,
  });

  const uploadAttachment = useMutation({
    mutationFn: ({ id, uri, fileName, mimeType, type }: { id: string; uri: string; fileName: string; mimeType: string; type: AttachmentType }) =>
      uploadTicketAttachment(id, uri, fileName, mimeType, type),
    onSuccess: invalidate,
    onError: onErr,
  });

  const addCost = useMutation({
    mutationFn: ({ id, description, amount, sparePartUsed }: { id: string; description: string; amount: number; sparePartUsed?: boolean }) =>
      addTicketCost(id, description, amount, sparePartUsed),
    onSuccess: invalidate,
    onError: onErr,
  });

  return {
    create,
    assign,
    updateAssignment,
    closeDirect,
    reopen,
    hold,
    resume,
    acknowledge,
    maintHold,
    maintResume,
    markVerificationNeeded: markVerificationNeededM,
    verifyAndClose: verifyAndCloseM,
    rejectVerification: rejectVerificationM,
    startProgress,
    updatePriority,
    addComment,
    uploadAttachment,
    addCost,
  };
}
