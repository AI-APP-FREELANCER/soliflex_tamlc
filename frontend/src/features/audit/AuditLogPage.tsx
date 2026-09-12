import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog, fetchAuditEntityTypes } from "./api";
import { Spinner, EmptyState } from "../../components/Spinner";
import { Avatar } from "../../components/Avatar";
import { DateRangeFilter, DateRangeValue } from "../../components/DateRangeFilter";
import { formatIST } from "../../lib/formatIST";

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors[cursors.length - 1];

  const { data: entityTypes = [] } = useQuery({ queryKey: ["audit-entity-types"], queryFn: fetchAuditEntityTypes });
  const { data, isLoading } = useQuery({
    queryKey: ["audit", entityType, dateRange, cursor],
    queryFn: () => fetchAuditLog({ entityType: entityType || undefined, cursor, ...dateRange }),
  });

  function changeFilter(value: string) {
    setEntityType(value);
    setCursors([]);
  }

  function changeDateRange(value: DateRangeValue) {
    setDateRange(value);
    setCursors([]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-soliflex-ink">Audit Log</h1>
          <p className="text-sm text-soliflex-gray-400">Immutable record of who changed what, and when.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={entityType} onChange={(e) => changeFilter(e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <DateRangeFilter value={dateRange} onChange={changeDateRange} />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState title="No audit entries" description="Changes to tickets, users, and assets will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-soliflex-gray-100 bg-soliflex-ink">
          <table className="w-full min-w-[720px] font-mono text-xs text-soliflex-gray-200">
            <thead className="bg-black/20 text-left uppercase tracking-wide text-soliflex-gray-400">
              <tr>
                <th className="px-4 py-2">When (IST)</th>
                <th className="px-4 py-2">Who</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-t border-white/5 align-top hover:bg-white/5">
                  <td className="whitespace-nowrap px-4 py-2 text-emerald-400">{formatIST(e.changedAt, "yyyy-MM-dd HH:mm:ss")}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.changedBy.name} size={18} />
                      {e.changedBy.name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sky-300">
                    {e.entityType}
                    <span className="block text-soliflex-gray-500">{e.entityId}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-amber-300">{e.action}</span>
                  </td>
                  <td className="px-4 py-2">
                    {e.field && <span className="font-semibold text-soliflex-gray-300">{e.field}: </span>}
                    {e.oldValue !== null && (
                      <>
                        <span className="text-red-400 line-through">{e.oldValue}</span>{" "}
                      </>
                    )}
                    {e.newValue !== null && <span className="text-green-400">{e.newValue}</span>}
                    {e.oldValue === null && e.newValue === null && <span className="text-soliflex-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 font-sans">
            <button
              onClick={() => setCursors((c) => c.slice(0, -1))}
              disabled={cursors.length === 0}
              className="text-xs font-medium text-soliflex-gray-400 hover:underline disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => data.nextCursor && setCursors((c) => [...c, data.nextCursor!])}
              disabled={!data.nextCursor}
              className="text-xs font-medium text-soliflex-orange-400 hover:underline disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
