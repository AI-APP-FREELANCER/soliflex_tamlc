import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-client";
import type { HelpdeskFilter } from "@/lib/types";
import {
  addHelpdeskComment,
  assignHelpdeskTicket,
  closeHelpdeskTicket,
  createHelpdeskTicket,
  fetchHelpdeskDashboardStats,
  fetchHelpdeskTicket,
  fetchHelpdeskTickets,
  holdHelpdeskTicket,
  reopenHelpdeskTicket,
  resolveHelpdeskTicket,
  resumeHelpdeskTicket,
  startHelpdeskProgress,
  updateHelpdeskDeadline,
  type AssignHelpdeskInput,
  type CreateHelpdeskTicketInput,
} from "@/api/helpdesk";

export function useHelpdeskTickets(filter: HelpdeskFilter) {
  return useQuery({
    queryKey: ["helpdesk-tickets", filter],
    queryFn: () => fetchHelpdeskTickets(filter),
  });
}

export function useHelpdeskTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["helpdesk-ticket", id],
    queryFn: () => fetchHelpdeskTicket(id as string),
    enabled: !!id,
  });
}

export function useHelpdeskDashboardStats(filter: HelpdeskFilter) {
  return useQuery({
    queryKey: ["helpdesk-dashboard", filter],
    queryFn: () => fetchHelpdeskDashboardStats(filter),
  });
}

function onErr(err: unknown) {
  Alert.alert("Something went wrong", apiErrorMessage(err));
}

export function useHelpdeskMutations(ticketId?: string) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    qc.invalidateQueries({ queryKey: ["helpdesk-dashboard"] });
    if (ticketId) qc.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
  }

  const create = useMutation({
    mutationFn: (input: CreateHelpdeskTicketInput) => createHelpdeskTicket(input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const assign = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignHelpdeskInput }) => assignHelpdeskTicket(id, input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const updateDeadline = useMutation({
    mutationFn: ({ id, deadline }: { id: string; deadline: string }) => updateHelpdeskDeadline(id, deadline),
    onSuccess: invalidate,
    onError: onErr,
  });

  const startProgress = useMutation({
    mutationFn: (id: string) => startHelpdeskProgress(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const hold = useMutation({
    mutationFn: ({ id, detail }: { id: string; detail: string }) => holdHelpdeskTicket(id, detail),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resume = useMutation({
    mutationFn: (id: string) => resumeHelpdeskTicket(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resolve = useMutation({
    mutationFn: ({ id, resolutionComment }: { id: string; resolutionComment?: string }) =>
      resolveHelpdeskTicket(id, resolutionComment),
    onSuccess: invalidate,
    onError: onErr,
  });

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reopenHelpdeskTicket(id, reason),
    onSuccess: invalidate,
    onError: onErr,
  });

  const close = useMutation({
    mutationFn: (id: string) => closeHelpdeskTicket(id),
    onSuccess: invalidate,
    onError: onErr,
  });

  const addComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => addHelpdeskComment(id, body),
    onSuccess: invalidate,
    onError: onErr,
  });

  return { create, assign, updateDeadline, startProgress, hold, resume, resolve, reopen, close, addComment };
}
