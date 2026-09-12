import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchHelpdeskDashboardStats } from "./api";
import { HELPDESK_STATUS_LABELS } from "./badges";
import { StatCard } from "../../components/StatCard";
import { DateRangeFilter, DateRangeValue } from "../../components/DateRangeFilter";
import { Spinner } from "../../components/Spinner";

export default function HelpdeskDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const { data: stats, isLoading } = useQuery({
    queryKey: ["helpdesk-dashboard", dateRange],
    queryFn: () => fetchHelpdeskDashboardStats(dateRange),
  });

  if (isLoading || !stats) return <Spinner />;

  const statusData = stats.byStatus.map((s) => ({ name: HELPDESK_STATUS_LABELS[s.status], count: s.count }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-soliflex-ink">Helpdesk Dashboard</h1>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total tickets" value={stats.total} />
        <StatCard label="Overdue" value={stats.overdueCount} tone="danger" />
        <StatCard label="Missing deadline" value={stats.missingDeadlineCount} tone="warn" />
        <StatCard label="Engineers tracked" value={stats.perEngineerWorkload.length} />
      </div>

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

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Engineer workload</h2>
        {stats.perEngineerWorkload.length === 0 ? (
          <p className="text-sm text-soliflex-gray-400">No IT Support Engineers found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-soliflex-gray-500">
              <tr>
                <th className="py-2">Engineer</th>
                <th className="py-2">Assigned</th>
                <th className="py-2">In progress</th>
                <th className="py-2">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {stats.perEngineerWorkload.map((e) => (
                <tr key={e.engineerId} className="border-t border-soliflex-gray-50">
                  <td className="py-2 font-medium text-soliflex-ink">{e.name}</td>
                  <td className="py-2">{e.open}</td>
                  <td className="py-2">{e.inProgress}</td>
                  <td className={`py-2 ${e.overdue > 0 ? "font-semibold text-red-600" : ""}`}>{e.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
