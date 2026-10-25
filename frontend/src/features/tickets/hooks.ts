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
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["overdue-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["maintenance-analytics"] });
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
    // IT only
    assign: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.assignTicket>[1] }) => ticketsApi.assignTicket(vars.id, vars.data), "Ticket assigned"),
    updateAssignment: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.updateAssignment>[1] }) => ticketsApi.updateAssignment(vars.id, vars.data), "Assignment updated"),
    closeDirect: wrap(
      (vars: { id: string; data: Parameters<typeof ticketsApi.closeTicketDirect>[1] }) => ticketsApi.closeTicketDirect(vars.id, vars.data),
      "Ticket closed"
    ),
    reopen: wrap((vars: { id: string; reason: string }) => ticketsApi.reopenTicket(vars.id, vars.reason), "Ticket reopened"),
    hold: wrap((vars: { id: string; detail: string }) => ticketsApi.holdTicket(vars.id, vars.detail), "Ticket put on hold"),
    resume: wrap((id: string) => ticketsApi.resumeTicket(id), "Ticket resumed"),
    // maintenance only
    acknowledge: wrap((vars: { id: string; assigneeId?: string }) => ticketsApi.acknowledgeTicket(vars.id, vars.assigneeId), "Ticket acknowledged"),
    maintHold: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.holdMaintenanceTicket>[1] }) => ticketsApi.holdMaintenanceTicket(vars.id, vars.data), "Ticket put on hold"),
    maintResume: wrap((id: string) => ticketsApi.resumeMaintenanceTicket(id), "Ticket resumed"),
    markVerificationNeeded: wrap(
      (vars: { id: string; data: ticketsApi.ChecklistInput }) => ticketsApi.markVerificationNeeded(vars.id, vars.data),
      "Sent for production verification"
    ),
    verifyAndClose: wrap(
      (vars: { id: string; data: Parameters<typeof ticketsApi.verifyAndClose>[1] }) => ticketsApi.verifyAndClose(vars.id, vars.data),
      "Ticket verified and closed"
    ),
    rejectVerification: wrap(
      (vars: { id: string; data: Parameters<typeof ticketsApi.rejectVerification>[1] }) => ticketsApi.rejectVerification(vars.id, vars.data),
      "Sent back to the maintenance team"
    ),
    // shared
    startProgress: wrap((id: string) => ticketsApi.startProgress(id), "Work started"),
    updatePriority: wrap((vars: { id: string; priority: Parameters<typeof ticketsApi.updatePriority>[1] }) => ticketsApi.updatePriority(vars.id, vars.priority), "Priority updated"),
    addComment: wrap((vars: { id: string; body: string }) => ticketsApi.addComment(vars.id, vars.body)),
    addAttachment: wrap((vars: { id: string; file: File; type: Parameters<typeof ticketsApi.addAttachment>[2] }) => ticketsApi.addAttachment(vars.id, vars.file, vars.type), "File uploaded"),
    addCostEntry: wrap((vars: { id: string; data: Parameters<typeof ticketsApi.addCostEntry>[1] }) => ticketsApi.addCostEntry(vars.id, vars.data), "Cost entry added"),
  };
}
