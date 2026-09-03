import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkstreamStore } from "../../store/workstream.store";
import { useAuthStore } from "../../store/auth.store";
import { fetchMaintenanceAssets, fetchITAssets } from "./api";
import { Spinner, EmptyState } from "../../components/Spinner";
import { CreateMaintenanceAssetModal } from "./CreateMaintenanceAssetModal";
import { CreateITAssetModal } from "./CreateITAssetModal";

export default function AssetsPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance-assets", search],
    queryFn: () => fetchMaintenanceAssets(search),
    enabled: workstream === "MAINTENANCE",
  });
  const itQuery = useQuery({
    queryKey: ["it-assets", search],
    queryFn: () => fetchITAssets(search),
    enabled: workstream === "IT",
  });

  const isLoading = workstream === "MAINTENANCE" ? maintenanceQuery.isLoading : itQuery.isLoading;
  const assets = workstream === "MAINTENANCE" ? maintenanceQuery.data ?? [] : itQuery.data ?? [];

  const canCreate =
    user?.role === "MANAGER" ||
    (workstream === "MAINTENANCE" && (user?.role === "ADMIN" || user?.role === "PRODUCTION")) ||
    (workstream === "IT" && user?.role === "IT_TEAM");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-soliflex-ink">{workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Assets</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets" className="rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm" />
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600">
            <Plus className="h-4 w-4" /> Onboard asset
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : assets.length === 0 ? (
        <EmptyState title="No assets found" description="Onboard your first asset to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/assets/${workstream === "MAINTENANCE" ? "maintenance" : "it"}/${a.id}`)}
              className="rounded-xl border border-soliflex-gray-100 bg-white p-4 text-left shadow-card hover:border-soliflex-orange-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-soliflex-orange-600">{a.itemCode}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    a.status === "ACTIVE" ? "bg-green-50 text-green-700" : a.status === "DOWN" ? "bg-red-50 text-red-700" : "bg-soliflex-gray-100 text-soliflex-gray-500"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-soliflex-ink">{a.name}</p>
              <p className="text-xs text-soliflex-gray-400">{a.category.replace(/_/g, " ")}</p>
            </button>
          ))}
        </div>
      )}

      {createOpen && workstream === "MAINTENANCE" && <CreateMaintenanceAssetModal onClose={() => setCreateOpen(false)} />}
      {createOpen && workstream === "IT" && <CreateITAssetModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
