import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LifeBuoy, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { fetchHelpdeskDashboardStats } from "./api";

/**
 * Helpdesk tickets are a separate system from the maintenance/IT-asset Ticket
 * workflow (raised by employees, tracked in their own table) and never appear
 * on the Board or All Tickets pages. This banner surfaces that fact directly
 * on those pages instead of relying on someone noticing the sidebar link —
 * added after a customer reported employee-raised tickets "missing" from the
 * Board, which was actually working as designed but not discoverable enough.
 */
export function HelpdeskDiscoveryBanner() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canSeeHelpdesk = user?.role === "ADMIN" || user?.role === "IT_TEAM_LEAD";

  const { data: stats } = useQuery({
    queryKey: ["helpdesk-dashboard", "banner"],
    queryFn: () => fetchHelpdeskDashboardStats({}),
    enabled: canSeeHelpdesk,
  });

  if (!canSeeHelpdesk || !stats) return null;

  const closedCount = stats.byStatus.find((s) => s.status === "CLOSED")?.count ?? 0;
  const openCount = stats.total - closedCount;

  if (openCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/helpdesk")}
      className="mb-4 flex w-full items-center gap-3 rounded-xl border border-soliflex-orange-100 bg-soliflex-orange-50 px-4 py-3 text-left transition hover:bg-soliflex-orange-100"
    >
      <LifeBuoy className="h-5 w-5 shrink-0 text-soliflex-orange-600" />
      <p className="flex-1 text-sm text-soliflex-orange-800">
        <span className="font-semibold">{openCount}</span> open helpdesk ticket{openCount === 1 ? "" : "s"} raised by employees
        {stats.overdueCount > 0 && (
          <>
            {" "}
            · <span className="font-semibold text-red-700">{stats.overdueCount} overdue</span>
          </>
        )}
        {" "}— these are tracked separately and don't appear here.
      </p>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-soliflex-orange-700">
        View Helpdesk Queue <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
