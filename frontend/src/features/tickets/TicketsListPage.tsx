import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkstreamStore } from "../../store/workstream.store";
import { useTickets } from "./hooks";
import { StatusBadge, PriorityBadge, OnHoldBadge, SlaBreachBadge } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { Spinner, EmptyState } from "../../components/Spinner";
import type { Priority, TicketStatus } from "../../lib/types";
import { format } from "date-fns";

export default function TicketsListPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useTickets({
    workstream,
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-soliflex-ink">All {workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Tickets</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or ticket #"
          className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {(["OPEN", "ASSIGNED", "IN_PROGRESS", "FIRST_LINE_REVIEW", "JOB_COMPLETED", "FINAL_REVIEW", "CLOSED"] as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All priorities</option>
          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets found" description="Try adjusting the filters or raise a new ticket." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-soliflex-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-soliflex-gray-50 text-left text-xs font-semibold uppercase text-soliflex-gray-500">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="cursor-pointer border-t border-soliflex-gray-50 hover:bg-soliflex-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-soliflex-ink">{t.ticketNumber}</p>
                    <p className="text-xs text-soliflex-gray-400">{t.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">{t.assignedTo ? <Avatar name={t.assignedTo.name} size={24} /> : <span className="text-xs text-soliflex-gray-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-xs text-soliflex-gray-400">{format(new Date(t.createdAt), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3 space-x-1">
                    {t.onHold && <OnHoldBadge />}
                    {t.slaBreached && <SlaBreachBadge />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
