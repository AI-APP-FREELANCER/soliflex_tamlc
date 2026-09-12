import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import * as helpdeskApi from "./api";
import type { HelpdeskFilter } from "./api";
import { apiErrorMessage } from "../../lib/api";

export function useHelpdeskTickets(filter: HelpdeskFilter) {
  return useQuery({
    queryKey: ["helpdesk-tickets", filter],
    queryFn: () => helpdeskApi.fetchHelpdeskTickets(filter),
  });
}

export function useHelpdeskTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["helpdesk-ticket", id],
    queryFn: () => helpdeskApi.fetchHelpdeskTicket(id!),
    enabled: !!id,
  });
}

export function useHelpdeskMutations(ticketId?: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-dashboard"] });
    if (ticketId) queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
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
    create: wrap(helpdeskApi.createHelpdeskTicket, "Helpdesk ticket raised"),
    assign: wrap((vars: { id: string; data: Parameters<typeof helpdeskApi.assignHelpdeskTicket>[1] }) => helpdeskApi.assignHelpdeskTicket(vars.id, vars.data), "Ticket assigned"),
    updateDeadline: wrap((vars: { id: string; deadline: string }) => helpdeskApi.updateHelpdeskDeadline(vars.id, vars.deadline), "Deadline updated"),
    startProgress: wrap((id: string) => helpdeskApi.startHelpdeskProgress(id), "Work started"),
    hold: wrap((vars: { id: string; detail: string }) => helpdeskApi.holdHelpdeskTicket(vars.id, vars.detail), "Ticket put on hold"),
    resume: wrap((id: string) => helpdeskApi.resumeHelpdeskTicket(id), "Ticket resumed"),
    resolve: wrap((vars: { id: string; resolutionComment?: string }) => helpdeskApi.resolveHelpdeskTicket(vars.id, vars.resolutionComment), "Ticket resolved"),
    reopen: wrap((vars: { id: string; reason: string }) => helpdeskApi.reopenHelpdeskTicket(vars.id, vars.reason), "Ticket reopened"),
    close: wrap((id: string) => helpdeskApi.closeHelpdeskTicket(id), "Ticket closed"),
    addComment: wrap((vars: { id: string; body: string }) => helpdeskApi.addHelpdeskComment(vars.id, vars.body)),
  };
}
