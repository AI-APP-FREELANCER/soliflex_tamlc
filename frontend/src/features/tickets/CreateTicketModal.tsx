import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { QrScannerModal } from "../../components/QrScannerModal";
import { ISTClock } from "../../components/ISTClock";
import { MACHINE_STATUS_LABELS, PROBLEM_TYPE_LABELS } from "../../components/badges";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useWorkstreamStore } from "../../store/workstream.store";
import { allowedCategoriesForCreate, allowedWorkstreamsForCreate, categoriesFor } from "./permissions";
import { useTicketMutations } from "./hooks";
import type { MachineStatus, ProblemType, TicketCategory, Workstream } from "../../lib/types";
import { fetchITAssets } from "../assets/api";
import { fetchPlants } from "../plants/api";
import { fetchDepartments } from "../departments/api";

const PROBLEM_TYPES: ProblemType[] = ["ELECTRICAL", "MECHANICAL", "PNEUMATIC", "HYDRAULIC", "OTHERS"];

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
  const [plantId, setPlantId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [problemType, setProblemType] = useState<ProblemType | "">("");
  const [machineStatus, setMachineStatus] = useState<MachineStatus>("RUNNING");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const { create } = useTicketMutations();
  const boardWorkstream = useWorkstreamStore((s) => s.workstream);
  const isMaintenance = workstream === "MAINTENANCE";

  // Each time the dialog opens, start from the workstream the user is looking at
  // (raising from the IT board must default to IT, not Maintenance).
  useEffect(() => {
    if (!open || !user) return;
    const allowed = allowedWorkstreamsForCreate(user.role);
    const ws = allowed.includes(boardWorkstream) ? boardWorkstream : allowed[0];
    if (!ws) return;
    setWorkstream(ws);
    setCategory(allowedCategoriesForCreate(user.role, ws)[0] ?? "");
    setAssetId(null);
    setAssetSearch("");
    setProblemType("");
    setMachineStatus("RUNNING");
    setPlantId("");
    setDepartmentId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: itAssets = [] } = useQuery({
    queryKey: ["it-assets", assetSearch],
    queryFn: () => fetchITAssets(assetSearch),
    enabled: open && workstream === "IT",
  });
  const { data: plants = [] } = useQuery({ queryKey: ["plants"], queryFn: () => fetchPlants(), enabled: open && isMaintenance });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments(), enabled: open && isMaintenance });

  if (!open || !user) return null;

  function reset() {
    setTitle("");
    setDescription("");
    setPlantId("");
    setDepartmentId("");
    setProblemType("");
    setMachineStatus("RUNNING");
    setAssetId(null);
    setAssetSearch("");
  }

  const canSubmit = isMaintenance
    ? !!category && description.trim().length >= 3 && !!plantId && !!departmentId && !!problemType
    : !!category && title.trim().length >= 3 && description.trim().length >= 3;

  async function handleSubmit() {
    if (!canSubmit || !category) return;
    const ticket = await create.mutateAsync(
      isMaintenance
        ? {
            workstream,
            category: category as TicketCategory,
            description,
            plantId,
            departmentId,
            problemType: problemType as ProblemType,
            machineStatus,
          }
        : {
            workstream,
            category: category as TicketCategory,
            title,
            description,
            itAssetId: assetId ?? undefined,
          }
    );
    reset();
    setOpen(false);
    navigate(`/tickets/${ticket.id}`);
  }

  return (
    <>
      <Modal title="Raise a ticket" onClose={() => setOpen(false)} width="max-w-xl">
        <div className="space-y-4">
          <div className="flex justify-end">
            <ISTClock />
          </div>

          {allowedWorkstreams.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Workstream</label>
              <div className="grid grid-cols-2 gap-2">
                {allowedWorkstreams.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => {
                      setWorkstream(ws);
                      setCategory(user ? allowedCategoriesForCreate(user.role, ws)[0] ?? "" : "");
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

          {isMaintenance ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Plant Location</label>
                  <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
                    <option value="" disabled>
                      Select plant
                    </option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Department / Product Category</label>
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
                    <option value="" disabled>
                      Select department
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Type of Problem</label>
                <select value={problemType} onChange={(e) => setProblemType(e.target.value as ProblemType)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
                  <option value="" disabled>
                    Select problem type
                  </option>
                  {PROBLEM_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {PROBLEM_TYPE_LABELS[pt]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Machine Status</label>
                <div className="flex gap-4">
                  {(["RUNNING", "STOPPED"] as MachineStatus[]).map((ms) => (
                    <label key={ms} className="flex items-center gap-2 text-sm text-soliflex-gray-700">
                      <input type="radio" name="machineStatus" checked={machineStatus === ms} onChange={() => setMachineStatus(ms)} />
                      {MACHINE_STATUS_LABELS[ms]}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the issue"
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">{isMaintenance ? "Problem Description" : "Description"}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the issue in detail"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
            />
          </div>

          {!isMaintenance && (
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
                  {itAssets.length === 0 && <p className="px-3 py-2 text-xs text-soliflex-gray-400">No matches</p>}
                  {itAssets.map((a) => (
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
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || create.isPending}
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
