import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal } from "../../components/Modal";
import { createMaintenanceAsset } from "./api";
import type { MaintenanceAssetCategory } from "../../lib/types";
import { apiErrorMessage } from "../../lib/api";

const CATEGORIES: { value: MaintenanceAssetCategory; label: string }[] = [
  { value: "PRODUCTION_MACHINE", label: "Production Machine" },
  { value: "PLANT_EQUIPMENT", label: "Plant Equipment" },
  { value: "PERIPHERAL_ATTACHMENT", label: "Peripheral Attachment" },
  { value: "PHYSICAL_TOOL", label: "Physical Tool" },
];

export function CreateMaintenanceAssetModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    category: "PRODUCTION_MACHINE" as MaintenanceAssetCategory,
    model: "",
    manufacturer: "",
    plantLocation: "",
    specifications: "",
    purchaseDate: "",
    warrantyStartDate: "",
    warrantyEndDate: "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createMaintenanceAsset,
    onSuccess: () => {
      toast.success("Asset onboarded");
      queryClient.invalidateQueries({ queryKey: ["maintenance-assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Onboard maintenance asset" onClose={onClose}>
      <div className="space-y-3">
        <input placeholder="Asset name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <select value={form.category} onChange={(e) => set("category", e.target.value as MaintenanceAssetCategory)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Model" value={form.model} onChange={(e) => set("model", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <input placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <input placeholder="Plant location" value={form.plantLocation} onChange={(e) => set("plantLocation", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <textarea placeholder="Specifications" value={form.specifications} onChange={(e) => set("specifications", e.target.value)} rows={2} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">Purchase date</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">Warranty start</label>
            <input type="date" value={form.warrantyStartDate} onChange={(e) => set("warrantyStartDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">Warranty end</label>
            <input type="date" value={form.warrantyEndDate} onChange={(e) => set("warrantyEndDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          onClick={() => mutation.mutate({ ...form, model: form.model || undefined, manufacturer: form.manufacturer || undefined, plantLocation: form.plantLocation || undefined, specifications: form.specifications || undefined, purchaseDate: form.purchaseDate || undefined, warrantyStartDate: form.warrantyStartDate || undefined, warrantyEndDate: form.warrantyEndDate || undefined })}
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Onboard asset
        </button>
        <p className="text-xs text-soliflex-gray-400">A sequential item code and QR code will be generated automatically. You can upload photos from the asset detail page.</p>
      </div>
    </Modal>
  );
}
