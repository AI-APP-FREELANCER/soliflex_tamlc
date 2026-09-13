import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal } from "../../components/Modal";
import { createITAsset } from "./api";
import type { ITAssetCategory } from "../../lib/types";
import { apiErrorMessage } from "../../lib/api";

const CATEGORIES: { value: ITAssetCategory; label: string }[] = [
  { value: "WORKSTATION", label: "Workstation" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "NETWORK_GEAR", label: "Network Gear" },
  { value: "SERVER", label: "Server" },
  { value: "SOFTWARE_LICENSE", label: "Software License" },
  { value: "SECURITY", label: "Security" },
  { value: "STORAGE", label: "Storage" },
];

export function CreateITAssetModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    category: "LAPTOP" as ITAssetCategory,
    serialNumber: "",
    specifications: "",
    ipAddress: "",
    macAddress: "",
    vendor: "",
    purchaseDate: "",
    warrantyEndDate: "",
    licenseExpiryDate: "",
    costCenter: "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createITAsset,
    onSuccess: () => {
      toast.success("Asset onboarded");
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Onboard IT asset" onClose={onClose}>
      <div className="space-y-3">
        <input placeholder="Asset name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <select value={form.category} onChange={(e) => set("category", e.target.value as ITAssetCategory)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
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
          onClick={() =>
            mutation.mutate({
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
            })
          }
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Onboard asset
        </button>
        <p className="text-xs text-soliflex-gray-400">A sequential item code and QR code will be generated automatically. You can attach vendor invoices from the asset detail page.</p>
      </div>
    </Modal>
  );
}
