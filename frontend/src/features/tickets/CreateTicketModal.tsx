import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { Modal } from "../../components/Modal";
import { QrScannerModal } from "../../components/QrScannerModal";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { allowedCategoriesForCreate, allowedWorkstreamsForCreate, categoriesFor } from "./permissions";
import { useTicketMutations } from "./hooks";
import type { TicketCategory, Workstream } from "../../lib/types";
import { fetchMaintenanceAssets } from "../assets/api";
import { fetchITAssets } from "../assets/api";
import { useNavigate } from "react-router-dom";

export function CreateTicketModal() {
  const open = useUIStore((s) => s.createTicketOpen);
  const setOpen = useUIStore((s) => s.setCreateTicketOpen);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const allowedWorkstreams = useMemo(() => (user ? allowedWorkstreamsForCreate(user.role) : []), [user]);
  const [workstream, setWorkstream] = useState<Workstream>(allowedWorkstreams[0] ?? "MAINTENANCE");
  const allowedCategories = useMemo(() => (user ? allowedCategoriesForCreate(user.role, workstream) : []), [user, workstream]);
  const [category, setCategory] = useState<TicketCategory | "">(allowedCategories[0] ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plantLocation, setPlantLocation] = useState("");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const { create } = useTicketMutations();

  const { data: maintenanceAssets = [] } = useQuery({
    queryKey: ["maintenance-assets", assetSearch],
    queryFn: () => fetchMaintenanceAssets(assetSearch),
    enabled: open && workstream === "MAINTENANCE",
  });
  const { data: itAssets = [] } = useQuery({
    queryKey: ["it-assets", assetSearch],
    queryFn: () => fetchITAssets(assetSearch),
    enabled: open && workstream === "IT",
  });

  if (!open || !user) return null;

  const assetOptions = workstream === "MAINTENANCE" ? maintenanceAssets : itAssets;

  function reset() {
    setTitle("");
    setDescription("");
    setPlantLocation("");
    setAssetId(null);
    setAssetSearch("");
  }

  async function handleSubmit() {
    if (!category) return;
    const ticket = await create.mutateAsync({
      workstream,
      category: category as TicketCategory,
      title,
      description,
      plantLocation: plantLocation || undefined,
      maintenanceAssetId: workstream === "MAINTENANCE" ? assetId ?? undefined : undefined,
      itAssetId: workstream === "IT" ? assetId ?? undefined : undefined,
    });
    reset();
    setOpen(false);
    navigate(`/tickets/${ticket.id}`);
  }

  return (
    <>
      <Modal title="Raise a ticket" onClose={() => setOpen(false)} width="max-w-xl">
        <div className="space-y-4">
          {allowedWorkstreams.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Workstream</label>
              <div className="grid grid-cols-2 gap-2">
                {allowedWorkstreams.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => {
                      setWorkstream(ws);
                      setCategory("");
                      setAssetId(null);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      workstream === ws ? "border-soliflex-orange-500 bg-soliflex-orange-50 text-soliflex-orange-700" : "border-soliflex-gray-200 text-soliflex-gray-600"
                    }`}
                  >
                    {ws === "MAINTENANCE" ? "Maintenance" : "IT"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            >
              <option value="" disabled>
                Select category
              </option>
              {categoriesFor(workstream)
                .filter((c) => allowedCategories.includes(c.value))
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the issue in detail"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Plant / Location</label>
            <input
              value={plantLocation}
              onChange={(e) => setPlantLocation(e.target.value)}
              placeholder="e.g. Plant A - Bay 3"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-soliflex-gray-700">Linked asset (optional)</label>
              <button onClick={() => setScannerOpen(true)} className="flex items-center gap-1 text-xs font-medium text-soliflex-orange-600">
                <QrCode className="h-3.5 w-3.5" /> Scan QR
              </button>
            </div>
            <input
              value={assetSearch}
              onChange={(e) => {
                setAssetSearch(e.target.value);
                setAssetId(null);
              }}
              placeholder="Search by item code or name"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            />
            {assetSearch && !assetId && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-soliflex-gray-100">
                {assetOptions.length === 0 && <p className="px-3 py-2 text-xs text-soliflex-gray-400">No matches</p>}
                {assetOptions.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAssetId(a.id);
                      setAssetSearch(`${a.itemCode} — ${a.name}`);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-soliflex-gray-50"
                  >
                    <span className="font-medium">{a.itemCode}</span> — {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!category || !title || !description || create.isPending}
            className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
          >
            Raise ticket
          </button>
        </div>
      </Modal>

      {scannerOpen && (
        <QrScannerModal
          onDetected={(code) => {
            setScannerOpen(false);
            setAssetSearch(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
