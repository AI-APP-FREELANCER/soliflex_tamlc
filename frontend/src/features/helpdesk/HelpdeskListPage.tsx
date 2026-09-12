import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useHelpdeskTickets } from "./hooks";
import { HelpdeskStatusBadge, HELPDESK_CATEGORY_LABELS, DeadlineBreachedBadge, OnHoldBadge, MissingDeadlineBadge } from "./badges";
import { CreateHelpdeskTicketModal } from "./CreateHelpdeskTicketModal";
import { AssignHelpdeskModal } from "./AssignHelpdeskModal";
import { DateRangeFilter, DateRangeValue } from "../../components/DateRangeFilter";
import { Avatar } from "../../components/Avatar";
import { Spinner, EmptyState } from "../../components/Spinner";
import { formatIST } from "../../lib/formatIST";
import type { HelpdeskCategory, HelpdeskStatus, HelpdeskTicket } from "../../lib/types";

const STATUSES: HelpdeskStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"];
const CATEGORIES = Object.keys(HELPDESK_CATEGORY_LABELS) as HelpdeskCategory[];

export default function HelpdeskListPage() {
  const user = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const [status, setStatus] = useState<HelpdeskStatus | "">("");
  const [category, setCategory] = useState<HelpdeskCategory | "">("");
  const [search, setSearch] = useState("");
  const [missingDeadline, setMissingDeadline] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTicket, setAssignTicket] = useState<HelpdeskTicket | null>(null);

  const isLead = user.role === "IT_TEAM_LEAD" || user.role === "ADMIN";
  const isEngineer = user.role === "IT_SUPPORT_ENGINEER";

  const { data: tickets = [], isLoading } = useHelpdeskTickets({
    status: status || undefined,
    category: category || undefined,
    search: search || undefined,
    missingDeadline: missingDeadline || undefined,
    ...dateRange,
  });

  const title = isLead ? "Helpdesk Queue" : isEngineer ? "My Queue" : "My Requests";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-soliflex-ink">{title}</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or ticket #"
          className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as HelpdeskStatus)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as HelpdeskCategory)} className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {HELPDESK_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {isLead && (
          <label className="flex items-center gap-1.5 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm text-soliflex-gray-700">
            <input type="checkbox" checked={missingDeadline} onChange={(e) => setMissingDeadline(e.target.checked)} />
            Missing deadline
          </label>
        )}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
        >
          <Plus className="h-4 w-4" /> Raise ticket
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyState title="No helpdesk tickets found" description="Try adjusting the filters or raise a new request." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-soliflex-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-soliflex-gray-50 text-left text-xs font-semibold uppercase text-soliflex-gray-500">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                {isLead && <th className="px-4 py-3">Raised by</th>}
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Flags</th>
                {isLead && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="cursor-pointer border-t border-soliflex-gray-50 hover:bg-soliflex-gray-50">
                  <td className="px-4 py-3" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    <p className="font-medium text-soliflex-ink">{t.ticketNumber}</p>
                    <p className="text-xs text-soliflex-gray-400">{t.title}</p>
                  </td>
                  <td className="px-4 py-3" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    {HELPDESK_CATEGORY_LABELS[t.category]}
                  </td>
                  <td className="px-4 py-3" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    <HelpdeskStatusBadge status={t.status} />
                  </td>
                  {isLead && (
                    <td className="px-4 py-3" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                      {t.raisedBy?.name}
                    </td>
                  )}
                  <td className="px-4 py-3" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    {t.assignedTo ? <Avatar name={t.assignedTo.name} size={24} /> : <span className="text-xs text-soliflex-gray-400">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-soliflex-gray-500" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    {t.deadline ? formatIST(t.deadline, "dd MMM, HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-3 space-x-1" onClick={() => navigate(`/helpdesk/${t.id}`)}>
                    {t.onHold && <OnHoldBadge />}
                    {t.deadlineBreached && <DeadlineBreachedBadge />}
                    {!t.deadline && (t.status === "ASSIGNED" || t.status === "IN_PROGRESS") && <MissingDeadlineBadge />}
                  </td>
                  {isLead && (
                    <td className="px-4 py-3">
                      {(t.status === "OPEN" || t.status === "ASSIGNED" || t.status === "REOPENED") && (
                        <button onClick={() => setAssignTicket(t)} className="text-xs font-medium text-soliflex-orange-600 hover:underline">
                          {t.assignedTo ? "Reassign" : "Assign"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateHelpdeskTicketModal onClose={() => setCreateOpen(false)} />}
      {assignTicket && <AssignHelpdeskModal ticket={assignTicket} onClose={() => setAssignTicket(null)} />}
    </div>
  );
}
