import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-client";
import type { AttachmentType, Priority, TicketFilter } from "@/lib/types";
import {
  addTicketComment,
  addTicketCost,
  assignTicket,
  closeTicket,
  createTicket,
  decideRecommendation,
  fetchTicket,
  fetchTickets,
  holdTicket,
  markFinalReview,
  markFirstLineReview,
  markJobCompleted,
  reopenTicket,
  resumeTicket,
  startTicketProgress,
  submitRecommendation,
  updateTicketAssignment,
  updateTicketPriority,
  uploadTicketAttachment,
  type AssignTicketInput,
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
    if (ticketId) qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
  }

  const create = useMutation({ mutationFn: (input: CreateTicketInput) => createTicket(input), onError: onErr });

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

  const updatePriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Priority }) => updateTicketPriority(id, priority),
    onSuccess: invalidate,
    onError: onErr,
  });

  const startProgress = useMutation({
    mutationFn: (id: string) => startTicketProgress(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const submitRecommendationM = useMutation({
    mutationFn: ({ id, diagnosis, recommendedFix }: { id: string; diagnosis: string; recommendedFix: string }) =>
      submitRecommendation(id, diagnosis, recommendedFix),
    onSuccess: invalidate,
    onError: onErr,
  });

  const decideRecommendationM = useMutation({
    mutationFn: ({ id, approve, comment }: { id: string; approve: boolean; comment?: string }) =>
      decideRecommendation(id, approve, comment),
    onSuccess: invalidate,
    onError: onErr,
  });

  const markFirstLineReviewM = useMutation({
    mutationFn: (id: string) => markFirstLineReview(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const markJobCompletedM = useMutation({
    mutationFn: (id: string) => markJobCompleted(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const markFinalReviewM = useMutation({
    mutationFn: (id: string) => markFinalReview(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const close = useMutation({
    mutationFn: ({ id, confirmEquipmentOperational, closingComment }: { id: string; confirmEquipmentOperational: boolean; closingComment?: string }) =>
      closeTicket(id, confirmEquipmentOperational, closingComment),
    onSuccess: invalidate,
    onError: onErr,
  });

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reopenTicket(id, reason),
    onSuccess: invalidate,
    onError: onErr,
  });

  const hold = useMutation({
    mutationFn: ({ id, reason, detail }: { id: string; reason: string; detail: string }) => holdTicket(id, reason, detail),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resume = useMutation({
    mutationFn: (id: string) => resumeTicket(id),
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
    updatePriority,
    startProgress,
    submitRecommendation: submitRecommendationM,
    decideRecommendation: decideRecommendationM,
    markFirstLineReview: markFirstLineReviewM,
    markJobCompleted: markJobCompletedM,
    markFinalReview: markFinalReviewM,
    close,
    reopen,
    hold,
    resume,
    addComment,
    uploadAttachment,
    addCost,
  };
}
