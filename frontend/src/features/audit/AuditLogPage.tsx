import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAuditLog, fetchAuditEntityTypes } from "./api";
import { Spinner, EmptyState } from "../../components/Spinner";
import { Avatar } from "../../components/Avatar";

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors[cursors.length - 1];

  const { data: entityTypes = [] } = useQuery({ queryKey: ["audit-entity-types"], queryFn: fetchAuditEntityTypes });
  const { data, isLoading } = useQuery({
    queryKey: ["audit", entityType, cursor],
    queryFn: () => fetchAuditLog({ entityType: entityType || undefined, cursor }),
  });

  function changeFilter(value: string) {
    setEntityType(value);
    setCursors([]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-soliflex-ink">Audit Log</h1>
          <p className="text-sm text-soliflex-gray-400">Immutable record of who changed what, and when.</p>
        </div>
        <select value={entityType} onChange={(e) => changeFilter(e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState title="No audit entries" description="Changes to tickets, users, and assets will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-soliflex-gray-100 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-soliflex-gray-50 text-left text-xs font-semibold uppercase text-soliflex-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-t border-soliflex-gray-50 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-soliflex-gray-500">{format(new Date(e.changedAt), "dd MMM yyyy, HH:mm")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.changedBy.name} size={22} />
                      {e.changedBy.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-soliflex-gray-600">
                    {e.entityType}
                    <span className="block text-xs text-soliflex-gray-400">{e.entityId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-soliflex-gray-100 px-2 py-0.5 text-xs font-semibold text-soliflex-gray-600">{e.action}</span>
                  </td>
                  <td className="px-4 py-3 text-soliflex-gray-600">
                    {e.field && <span className="font-medium">{e.field}: </span>}
                    {e.oldValue !== null && (
                      <>
                        <span className="text-soliflex-gray-400 line-through">{e.oldValue}</span>{" "}
                      </>
                    )}
                    {e.newValue !== null && <span>{e.newValue}</span>}
                    {e.oldValue === null && e.newValue === null && <span className="text-soliflex-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-soliflex-gray-50 px-4 py-3">
            <button
              onClick={() => setCursors((c) => c.slice(0, -1))}
              disabled={cursors.length === 0}
              className="text-xs font-medium text-soliflex-gray-500 hover:underline disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => data.nextCursor && setCursors((c) => [...c, data.nextCursor!])}
              disabled={!data.nextCursor}
              className="text-xs font-medium text-soliflex-orange-600 hover:underline disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
