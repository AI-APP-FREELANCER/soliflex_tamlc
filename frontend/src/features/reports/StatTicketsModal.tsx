import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Spinner, EmptyState } from "../../components/Spinner";
import { StatusBadge, PriorityBadge } from "../../components/badges";
import { fetchTickets } from "../tickets/api";
import type { DateRangeValue } from "../../components/DateRangeFilter";
import type { TicketStatus, Workstream } from "../../lib/types";

export type StatFilterKey = "total" | "open" | "inProgress" | "closed";

const TITLES: Record<StatFilterKey, string> = {
  total: "All tickets",
  open: "Open tickets",
  inProgress: "In-progress tickets",
  closed: "Closed tickets",
};

function matchesFilter(status: TicketStatus, key: StatFilterKey): boolean {
  if (key === "total") return true;
  if (key === "open") return status !== "CLOSED";
  if (key === "inProgress") return status === "IN_PROGRESS";
  return status === "CLOSED";
}

export function StatTicketsModal({
  filterKey,
  workstream,
  dateRange,
  onClose,
  onDownload,
}: {
  filterKey: StatFilterKey;
  workstream: Workstream;
  dateRange: DateRangeValue;
  onClose: () => void;
  onDownload: () => void;
}) {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["dashboard-stat-tickets", workstream, dateRange],
    queryFn: () => fetchTickets({ workstream, ...dateRange }),
  });
  const filtered = tickets.filter((t) => matchesFilter(t.status, filterKey));

  return (
    <Modal title={`${TITLES[filterKey]} (${filtered.length})`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-3">
        {workstream === "IT" && (
          <p className="text-xs text-soliflex-gray-400">
            Shows IT board tickets only — Helpdesk tickets raised by employees are tracked separately (see Helpdesk Queue).
          </p>
        )}
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200"
        >
          <Download className="h-3.5 w-3.5" /> Download Excel
        </button>

        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No tickets match this filter" />
        ) : (
          <div className="max-h-[55vh] space-y-1 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onClose();
                  navigate(`/tickets/${t.id}`);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-soliflex-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-soliflex-ink">{t.ticketNumber}</p>
                  <p className="truncate text-xs text-soliflex-gray-400">{t.displayTitle}</p>
                </div>
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
