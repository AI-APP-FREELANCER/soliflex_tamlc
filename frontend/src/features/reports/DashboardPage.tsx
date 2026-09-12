import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download } from "lucide-react";
import { useWorkstreamStore } from "../../store/workstream.store";
import { fetchDashboard, fetchExpiringAssets, fetchOverdueTickets } from "./api";
import { Spinner, EmptyState } from "../../components/Spinner";
import { STATUS_LABELS, StatusBadge, PriorityBadge } from "../../components/badges";
import { StatCard } from "../../components/StatCard";
import { DateRangeFilter, DateRangeValue } from "../../components/DateRangeFilter";
import { api } from "../../lib/api";
import { format, formatDistanceToNow } from "date-fns";
import type { Priority } from "../../lib/types";

const BREAKDOWN_COLORS = ["#F26522", "#A6392B", "#5D616B", "#DD5216"];

function PriorityBreakdown({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <EmptyState title="No prioritized tickets yet" />;
  return (
    <div className="flex h-full flex-col justify-center gap-4 py-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-soliflex-gray-100">
        {data.map((d, i) => (
          <div key={d.name} style={{ width: `${(d.value / total) * 100}%`, backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }} />
        ))}
      </div>
      <ul className="space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }} />
              {d.name}
            </span>
            <span className="text-soliflex-gray-500">
              {d.value} · {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const { data: stats, isLoading } = useQuery({ queryKey: ["dashboard", workstream, dateRange], queryFn: () => fetchDashboard(workstream, dateRange) });
  const { data: expiring } = useQuery({ queryKey: ["expiring-assets"], queryFn: () => fetchExpiringAssets(60) });
  const { data: overdueTickets } = useQuery({ queryKey: ["overdue-tickets", workstream, dateRange], queryFn: () => fetchOverdueTickets(workstream, dateRange) });

  async function handleExport() {
    const res = await api.get("/reports/export", { params: { workstream }, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soliflex-tickets-report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !stats) return <Spinner />;

  const statusData = stats.byStatus.map((s) => ({ name: STATUS_LABELS[s.status], count: s.count }));
  const priorityData = stats.byPriority
    .filter((p): p is { priority: Priority; count: number } => Boolean(p.priority))
    .map((p) => ({ name: p.priority, value: p.count }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-soliflex-ink">{workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Reports</h1>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total tickets" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Closed" value={stats.closed} />
        <StatCard label="On hold" value={stats.onHold} tone="warn" />
        <StatCard label="SLA breached" value={stats.slaBreached} tone="danger" />
        <StatCard label="Avg resolution (hrs)" value={stats.avgResolutionHours} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Tickets by status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#F26522" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Tickets by priority</h2>
          <div style={{ height: 260 }}>
            <PriorityBreakdown data={priorityData} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Tickets past their target completion date</h2>
        {overdueTickets && overdueTickets.length > 0 ? (
          <table className="w-full text-sm">
            <tbody>
              {overdueTickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="cursor-pointer border-t border-soliflex-gray-50 hover:bg-soliflex-gray-50"
                >
                  <td className="py-2 pr-3 font-medium text-soliflex-orange-600">{t.ticketNumber}</td>
                  <td className="max-w-[220px] truncate py-2 pr-3">{t.title}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 pr-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-2 pr-3 text-soliflex-gray-500">{t.assignedTo?.name ?? "Unassigned"}</td>
                  <td className="py-2 text-red-600">
                    {formatDistanceToNow(new Date(t.targetCompletionDate), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-soliflex-gray-400">Nothing overdue right now.</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Warranty / license expiring within 60 days</h2>
        {expiring && (expiring.maintenance.length > 0 || expiring.it.length > 0) ? (
          <table className="w-full text-sm">
            <tbody>
              {expiring.maintenance.map((a) => (
                <tr key={a.id} className="border-t border-soliflex-gray-50">
                  <td className="py-2 font-medium">{a.itemCode}</td>
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 text-soliflex-gray-400">{a.warrantyEndDate && format(new Date(a.warrantyEndDate), "dd MMM yyyy")}</td>
                </tr>
              ))}
              {expiring.it.map((a) => (
                <tr key={a.id} className="border-t border-soliflex-gray-50">
                  <td className="py-2 font-medium">{a.itemCode}</td>
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 text-soliflex-gray-400">
                    {(a.warrantyEndDate || a.licenseExpiryDate) && format(new Date(a.warrantyEndDate ?? a.licenseExpiryDate!), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-soliflex-gray-400">Nothing expiring soon.</p>
        )}
      </div>
    </div>
  );
}
