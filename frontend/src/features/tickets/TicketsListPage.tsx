import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkstreamStore } from "../../store/workstream.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useTickets } from "./hooks";
import { allowedWorkstreamsForCreate } from "./permissions";
import { StatusBadge, STATUS_LABELS, PriorityBadge, OnHoldBadge, SlaBreachBadge } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { Spinner, EmptyState } from "../../components/Spinner";
import { DateRangeFilter, DateRangeValue } from "../../components/DateRangeFilter";
import { HelpdeskDiscoveryBanner } from "../helpdesk/HelpdeskDiscoveryBanner";
import type { Priority, TicketStatus } from "../../lib/types";
import { format } from "date-fns";

export default function TicketsListPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const user = useAuthStore((s) => s.user);
  const setCreateTicketOpen = useUIStore((s) => s.setCreateTicketOpen);
  const canCreate = user ? allowedWorkstreamsForCreate(user.role).length > 0 : false;
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useTickets({
    workstream,
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
    ...dateRange,
  });

  return (
    <div>
      <HelpdeskDiscoveryBanner />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-soliflex-ink">All {workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Tickets</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket #, machine, plant, or category"
          className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {(workstream === "MAINTENANCE"
            ? (["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "ON_HOLD", "VERIFICATION_NEEDED", "VERIFIED", "REJECTED", "CLOSED"] as TicketStatus[])
            : (["OPEN", "ASSIGNED", "IN_PROGRESS", "CLOSED"] as TicketStatus[])
          ).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All priorities</option>
          {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {canCreate && (
          <button
            onClick={() => setCreateTicketOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
          >
            <Plus className="h-4 w-4" /> Raise ticket
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets found" description="Try adjusting the filters or raise a new ticket." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-soliflex-gray-100 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-soliflex-gray-50 text-left text-xs font-semibold uppercase text-soliflex-gray-500">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className={`cursor-pointer border-t border-soliflex-gray-50 hover:bg-soliflex-gray-50 ${t.priority === "HIGH" ? "border-l-2 border-l-red-400" : ""}`}
                >
                  <td className="px-4 py-3">
                    {t.machine ? (
                      <>
                        <p className={`font-semibold ${t.priority === "HIGH" ? "text-red-700" : "text-soliflex-ink"}`}>
                          {t.machine.name} <span className="font-normal text-soliflex-gray-400">({t.machine.itemCode})</span>
                        </p>
                        <p className="text-xs text-soliflex-gray-400">
                          {t.ticketNumber} · {t.displayTitle}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`font-semibold ${t.priority === "HIGH" ? "text-red-700" : "text-soliflex-ink"}`}>{t.ticketNumber}</p>
                        <p className="text-xs text-soliflex-gray-400">{t.displayTitle}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={t.reportedBy.name} size={24} />
                      <span className="text-xs text-soliflex-gray-700">{t.reportedBy.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={t.assignedTo.name} size={24} />
                        <span className="text-xs text-soliflex-gray-700">{t.assignedTo.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-soliflex-gray-400">Unassigned</span>
                    )}
                  </td>
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
