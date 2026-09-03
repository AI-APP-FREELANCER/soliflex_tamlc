import { api, API_BASE_URL } from "../../lib/api";
import type { DashboardStats, ITAsset, MaintenanceAsset, Workstream } from "../../lib/types";

export async function fetchDashboard(workstream?: Workstream): Promise<DashboardStats> {
  const res = await api.get("/reports/dashboard", { params: workstream ? { workstream } : {} });
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
