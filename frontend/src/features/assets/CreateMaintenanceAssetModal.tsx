import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Paperclip, X } from "lucide-react";
import { Modal } from "../../components/Modal";
import { createMaintenanceAsset, fetchMaintenanceAssetCategories, uploadMaintenanceAssetPhotos } from "./api";
import type { MaintenanceAssetCategory } from "../../lib/types";
import { apiErrorMessage } from "../../lib/api";

// Suggestions only — category is free text, any value is accepted.
const DEFAULT_CATEGORY_SUGGESTIONS = ["PRODUCTION_MACHINE", "PLANT_EQUIPMENT", "PERIPHERAL_ATTACHMENT", "PHYSICAL_TOOL"];

export function CreateMaintenanceAssetModal({ onClose }: { onClose: () => void }) {
  const { data: existingCategories = [] } = useQuery({ queryKey: ["maintenance-asset-categories"], queryFn: fetchMaintenanceAssetCategories });
  const categorySuggestions = Array.from(new Set([...existingCategories, ...DEFAULT_CATEGORY_SUGGESTIONS])).sort();

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
  const [photos, setPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: Parameters<typeof createMaintenanceAsset>[0]) => {
      const asset = await createMaintenanceAsset(input);
      if (photos.length > 0) {
        await uploadMaintenanceAssetPhotos(asset.id, photos);
      }
      return asset;
    },
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
        <div>
          <input
            list="maintenance-category-suggestions"
            placeholder="Category (e.g. PRODUCTION_MACHINE)"
            value={form.category}
            onChange={(e) => set("category", e.target.value as MaintenanceAssetCategory)}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
          <datalist id="maintenance-category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-soliflex-gray-400">Type any category — pick an existing one from the list or create a new one.</p>
        </div>
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

        <div>
          <label className="mb-1 block text-xs text-soliflex-gray-500">Initial photos</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-soliflex-gray-300 px-3 py-2.5 text-xs font-medium text-soliflex-gray-600 hover:border-soliflex-orange-300 hover:text-soliflex-orange-600"
          >
            <Paperclip className="h-3.5 w-3.5" /> Add photos
          </button>
          {photos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {photos.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-md bg-soliflex-gray-50 px-2 py-1 text-xs text-soliflex-gray-600">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="ml-2 text-soliflex-gray-400 hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => mutation.mutate({ ...form, model: form.model || undefined, manufacturer: form.manufacturer || undefined, plantLocation: form.plantLocation || undefined, specifications: form.specifications || undefined, purchaseDate: form.purchaseDate || undefined, warrantyStartDate: form.warrantyStartDate || undefined, warrantyEndDate: form.warrantyEndDate || undefined })}
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Onboard asset
        </button>
        <p className="text-xs text-soliflex-gray-400">A sequential item code and QR code will be generated automatically. More photos and invoices can be added later from the asset detail page.</p>
      </div>
    </Modal>
  );
}
