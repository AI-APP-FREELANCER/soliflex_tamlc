import { useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  fetchMaintenanceAsset,
  fetchITAsset,
  uploadMaintenanceAssetPhotos,
  uploadMaintenanceAssetInvoice,
  uploadITAssetInvoice,
} from "./api";
import { API_BASE_URL, apiErrorMessage } from "../../lib/api";
import { Spinner } from "../../components/Spinner";
import { format } from "date-fns";
import type { ITAsset, MaintenanceAsset } from "../../lib/types";

export default function AssetDetailPage() {
  const { type, id } = useParams<{ type: "maintenance" | "it"; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const isMaintenance = type === "maintenance";

  const { data: asset, isLoading } = useQuery<MaintenanceAsset | ITAsset>({
    queryKey: [isMaintenance ? "maintenance-asset" : "it-asset", id],
    queryFn: () => (isMaintenance ? fetchMaintenanceAsset(id!) : fetchITAsset(id!)),
    enabled: !!id,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [isMaintenance ? "maintenance-asset" : "it-asset", id] });
  }

  const photoMutation = useMutation({
    mutationFn: (files: FileList) => uploadMaintenanceAssetPhotos(id!, Array.from(files)),
    onSuccess: () => {
      toast.success("Photos uploaded");
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const invoiceMutation = useMutation({
    mutationFn: (file: File) => (isMaintenance ? uploadMaintenanceAssetInvoice(id!, file) : uploadITAssetInvoice(id!, file)),
    onSuccess: () => {
      toast.success("Invoice uploaded");
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading || !asset) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-soliflex-gray-500 hover:text-soliflex-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-soliflex-orange-600">{asset.itemCode}</span>
            <h1 className="text-lg font-bold text-soliflex-ink">{asset.name}</h1>
            <p className="text-sm text-soliflex-gray-400">{asset.category.replace(/_/g, " ")}</p>
            {asset.status === "DOWN" && (
              <p className="mt-1 text-xs font-semibold text-red-600">
                Down{asset.statusSince ? ` since ${formatDistanceToNow(new Date(asset.statusSince), { addSuffix: true })}` : ""}
              </p>
            )}
          </div>
          {asset.qrCodeUrl && <img src={`${API_BASE_URL}${asset.qrCodeUrl}`} alt="QR code" className="h-24 w-24 rounded-lg border border-soliflex-gray-100 p-1" />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {isMaintenance ? (
            <>
              <Field label="Model" value={(asset as any).model} />
              <Field label="Manufacturer" value={(asset as any).manufacturer} />
              <Field label="Plant location" value={(asset as any).plantLocation} />
              <Field label="Warranty end" value={(asset as any).warrantyEndDate && format(new Date((asset as any).warrantyEndDate), "dd MMM yyyy")} />
            </>
          ) : (
            <>
              <Field label="Serial number" value={(asset as any).serialNumber} />
              <Field label="Vendor" value={(asset as any).vendor} />
              <Field label="IP address" value={(asset as any).ipAddress} />
              <Field label="MAC address" value={(asset as any).macAddress} />
              <Field label="Cost center" value={(asset as any).costCenter} />
              <Field label="Warranty / license end" value={(asset as any).warrantyEndDate && format(new Date((asset as any).warrantyEndDate), "dd MMM yyyy")} />
            </>
          )}
        </div>
        {asset.specifications && <p className="mt-3 text-sm text-soliflex-gray-600">{asset.specifications}</p>}
      </div>

      {isMaintenance && (
        <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-soliflex-ink">Photos</h2>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <input ref={photoInputRef} type="file" multiple hidden onChange={(e) => e.target.files && photoMutation.mutate(e.target.files)} />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {(asset as MaintenanceAsset).photos.map((p) => (
              <img key={p.id} src={`${API_BASE_URL}${p.fileUrl}`} className="aspect-square w-full rounded-lg object-cover" />
            ))}
            {(asset as MaintenanceAsset).photos.length === 0 && <p className="text-sm text-soliflex-gray-400">No photos yet.</p>}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-soliflex-ink">Vendor invoices</h2>
          <button
            onClick={() => invoiceInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <input ref={invoiceInputRef} type="file" hidden onChange={(e) => e.target.files?.[0] && invoiceMutation.mutate(e.target.files[0])} />
        </div>
        <div className="space-y-2">
          {asset.invoices.map((inv) => (
            <a key={inv.id} href={`${API_BASE_URL}${inv.fileUrl}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-soliflex-gray-100 px-3 py-2 text-sm hover:border-soliflex-orange-300">
              {inv.invoiceNumber || "Invoice"} {inv.amount ? `— ₹${inv.amount.toLocaleString()}` : ""}
            </a>
          ))}
          {asset.invoices.length === 0 && <p className="text-sm text-soliflex-gray-400">No invoices yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-soliflex-gray-400">{label}</p>
      <p className="text-soliflex-ink">{value}</p>
    </div>
  );
}
