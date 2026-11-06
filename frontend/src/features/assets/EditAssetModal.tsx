import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal } from "../../components/Modal";
import { fetchPlants } from "../plants/api";
import { updateITAsset, updateMaintenanceAsset } from "./api";
import { apiErrorMessage } from "../../lib/api";
import type { ITAsset, MaintenanceAsset } from "../../lib/types";

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function EditMaintenanceAssetModal({ asset, onClose }: { asset: MaintenanceAsset; onClose: () => void }) {
  const { data: plants = [] } = useQuery({ queryKey: ["plants"], queryFn: () => fetchPlants() });
  const [form, setForm] = useState({
    name: asset.name,
    category: asset.category,
    model: asset.model ?? "",
    manufacturer: asset.manufacturer ?? "",
    plantLocation: asset.plantLocation ?? "",
    powerCapacity: asset.powerCapacity ?? "",
    specifications: asset.specifications ?? "",
    purchaseDate: toDateInput(asset.purchaseDate),
    warrantyStartDate: toDateInput(asset.warrantyStartDate),
    warrantyEndDate: toDateInput(asset.warrantyEndDate),
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      updateMaintenanceAsset(asset.id, {
        ...form,
        model: form.model || undefined,
        manufacturer: form.manufacturer || undefined,
        plantLocation: form.plantLocation || undefined,
        powerCapacity: form.powerCapacity || undefined,
        specifications: form.specifications || undefined,
        purchaseDate: form.purchaseDate || undefined,
        warrantyStartDate: form.warrantyStartDate || undefined,
        warrantyEndDate: form.warrantyEndDate || undefined,
      }),
    onSuccess: () => {
      toast.success("Asset updated");
      queryClient.invalidateQueries({ queryKey: ["maintenance-asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title={`Edit ${asset.itemCode}`} onClose={onClose}>
      <div className="space-y-3">
        <input placeholder="Asset name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Model" value={form.model} onChange={(e) => set("model", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <input placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.plantLocation} onChange={(e) => set("plantLocation", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="">Plant location (optional)</option>
            {plants.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <input placeholder="Power capacity (e.g. 15 kW)" value={form.powerCapacity} onChange={(e) => set("powerCapacity", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
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
          onClick={() => mutation.mutate()}
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </Modal>
  );
}

export function EditITAssetModal({ asset, onClose }: { asset: ITAsset; onClose: () => void }) {
  const [form, setForm] = useState({
    name: asset.name,
    category: asset.category,
    serialNumber: asset.serialNumber ?? "",
    specifications: asset.specifications ?? "",
    ipAddress: asset.ipAddress ?? "",
    macAddress: asset.macAddress ?? "",
    vendor: asset.vendor ?? "",
    purchaseDate: toDateInput(asset.purchaseDate),
    warrantyEndDate: toDateInput(asset.warrantyEndDate),
    licenseExpiryDate: toDateInput(asset.licenseExpiryDate),
    costCenter: asset.costCenter ?? "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      updateITAsset(asset.id, {
        ...form,
        serialNumber: form.serialNumber || undefined,
        specifications: form.specifications || undefined,
        ipAddress: form.ipAddress || undefined,
        macAddress: form.macAddress || undefined,
        vendor: form.vendor || undefined,
        purchaseDate: form.purchaseDate || undefined,
        warrantyEndDate: form.warrantyEndDate || undefined,
        licenseExpiryDate: form.licenseExpiryDate || undefined,
        costCenter: form.costCenter || undefined,
      }),
    onSuccess: () => {
      toast.success("Asset updated");
      queryClient.invalidateQueries({ queryKey: ["it-asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title={`Edit ${asset.itemCode}`} onClose={onClose}>
      <div className="space-y-3">
        <input placeholder="Asset name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Serial number" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <input placeholder="Vendor" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="IP address" value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <input placeholder="MAC address" value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <input placeholder="Cost center" value={form.costCenter} onChange={(e) => set("costCenter", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <textarea placeholder="Specifications" value={form.specifications} onChange={(e) => set("specifications", e.target.value)} rows={2} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">Purchase date</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">Warranty end</label>
            <input type="date" value={form.warrantyEndDate} onChange={(e) => set("warrantyEndDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-soliflex-gray-500">License expiry</label>
            <input type="date" value={form.licenseExpiryDate} onChange={(e) => set("licenseExpiryDate", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </Modal>
  );
}
