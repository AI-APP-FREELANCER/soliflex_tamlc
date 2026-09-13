import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import * as ticketsApi from "./api";
import type { TicketFilter } from "./api";
import { apiErrorMessage } from "../../lib/api";

export function useTickets(filter: TicketFilter) {
  return useQuery({
    queryKey: ["tickets", filter],
    queryFn: () => ticketsApi.fetchTickets(filter),
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.fetchTicket(id!),
    enabled: !!id,
  });
}

export function useTicketMutations(ticketId?: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    if (ticketId) queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
  }

  function wrap<T extends (...args: any[]) => Promise<any>>(fn: T, successMessage?: string) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        invalidate();
        if (successMessage) toast.success(successMessage);
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  }

  return {
    create: wrap(ticketsApi.createTicket, "Ticket raised"),
    assign: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.assignTicket>[1] }) => ticketsApi.assignTicket(vars.id, vars.data), "Ticket assigned"),
    updateAssignment: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.updateAssignment>[1] }) => ticketsApi.updateAssignment(vars.id, vars.data), "Assignment updated"),
    updatePriority: wrap((vars: { id: string; priority: Parameters<typeof ticketsApi.updatePriority>[1] }) => ticketsApi.updatePriority(vars.id, vars.priority), "Priority updated"),
    startProgress: wrap((id: string) => ticketsApi.startProgress(id), "Work started"),
    submitRecommendation: wrap(
      (vars: { id: string; data: Parameters<typeof ticketsApi.submitRecommendation>[1] }) => ticketsApi.submitRecommendation(vars.id, vars.data),
      "Recommendation submitted for approval"
    ),
    decideRecommendation: wrap(
      (vars: { id: string; data: Parameters<typeof ticketsApi.decideRecommendation>[1] }) => ticketsApi.decideRecommendation(vars.id, vars.data),
      "Decision recorded"
    ),
    markFirstLineReview: wrap((id: string) => ticketsApi.markFirstLineReview(id), "Submitted for 1st line review"),
    markJobCompleted: wrap((id: string) => ticketsApi.markJobCompleted(id), "Marked job completed"),
    markFinalReview: wrap((id: string) => ticketsApi.markFinalReview(id), "Sent to final review"),
    close: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.closeTicket>[1] }) => ticketsApi.closeTicket(vars.id, vars.data), "Ticket closed"),
    hold: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.holdTicket>[1] }) => ticketsApi.holdTicket(vars.id, vars.data), "Ticket put on hold"),
    resume: wrap((id: string) => ticketsApi.resumeTicket(id), "Ticket resumed"),
    addComment: wrap((vars: { id: string; body: string }) => ticketsApi.addComment(vars.id, vars.body)),
    addAttachment: wrap((vars: { id: string; file: File; type: Parameters<typeof ticketsApi.addAttachment>[2] }) => ticketsApi.addAttachment(vars.id, vars.file, vars.type), "File uploaded"),
    addCostEntry: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.addCostEntry>[1] }) => ticketsApi.addCostEntry(vars.id, vars.data), "Cost entry added"),
  };
}
