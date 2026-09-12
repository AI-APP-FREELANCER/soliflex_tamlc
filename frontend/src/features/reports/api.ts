import { api, API_BASE_URL } from "../../lib/api";
import type { DashboardStats, ITAsset, MaintenanceAsset, Priority, TicketStatus, Workstream } from "../../lib/types";
import type { DateRangeValue } from "../../components/DateRangeFilter";

export async function fetchDashboard(workstream?: Workstream, dateRange?: DateRangeValue): Promise<DashboardStats> {
  const res = await api.get("/reports/dashboard", { params: { ...(workstream ? { workstream } : {}), ...dateRange } });
  return res.data;
}

export interface OverdueTicket {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: Priority | null;
  targetCompletionDate: string;
  assignedTo: { name: string } | null;
}

export async function fetchOverdueTickets(workstream?: Workstream, dateRange?: DateRangeValue): Promise<OverdueTicket[]> {
  const res = await api.get("/reports/overdue-tickets", { params: { ...(workstream ? { workstream } : {}), ...dateRange } });
  return res.data;
}

export async function fetchExpiringAssets(days = 60): Promise<{ maintenance: MaintenanceAsset[]; it: ITAsset[] }> {
  const res = await api.get("/reports/expiring-assets", { params: { days } });
  return res.data;
}

export function exportUrl(workstream?: Workstream) {
  const params = workstream ? `?workstream=${workstream}` : "";
  return `${API_BASE_URL}/api/reports/export${params}`;
}
