import { api } from "@/lib/api-client";
import type { DashboardStats, DateRangeValue, ExpiringAssets, OverdueTicket, Workstream } from "@/lib/types";

export async function fetchReportsDashboard(workstream: Workstream | undefined, range: DateRangeValue): Promise<DashboardStats> {
  const res = await api.get("/reports/dashboard", { params: { workstream, ...range } });
  return res.data;
}

export async function fetchOverdueTickets(workstream: Workstream | undefined, range: DateRangeValue): Promise<OverdueTicket[]> {
  const res = await api.get("/reports/overdue-tickets", { params: { workstream, ...range } });
  return res.data;
}

export async function fetchExpiringAssets(days = 60): Promise<ExpiringAssets> {
  const res = await api.get("/reports/expiring-assets", { params: { days } });
  return res.data;
}

export async function fetchReportsExportBytes(workstream: Workstream | undefined, range: DateRangeValue = {}): Promise<ArrayBuffer> {
  const res = await api.get("/reports/export", { params: { workstream, ...range }, responseType: "arraybuffer" });
  return res.data;
}
