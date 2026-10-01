import { api } from "@/lib/api-client";
import type { AssetFilter, AssetType, ITAsset, MaintenanceAsset } from "@/lib/types";

function basePath(type: AssetType): string {
  return type === "maintenance" ? "/assets/maintenance" : "/assets/it";
}

/** Returns the union type — callers that know the literal `type` at the call
 * site can narrow with `as MaintenanceAsset`/`as ITAsset` (same approach the
 * asset detail screen already uses), since TS overloads don't narrow
 * correctly when `type` comes from a runtime AssetType variable. */
export async function fetchAssets(type: AssetType, filter: AssetFilter): Promise<(MaintenanceAsset | ITAsset)[]> {
  const res = await api.get(basePath(type), { params: filter });
  return res.data;
}

export async function fetchAssetCategories(type: AssetType): Promise<string[]> {
  const res = await api.get(`${basePath(type)}/categories`);
  return res.data;
}

export async function fetchAsset(type: AssetType, id: string): Promise<MaintenanceAsset | ITAsset> {
  const res = await api.get(`${basePath(type)}/${id}`);
  return res.data;
}

export interface CreateMaintenanceAssetInput {
  name: string;
  category: string;
  model?: string;
  manufacturer?: string;
  plantLocation?: string;
  specifications?: string;
  purchaseDate?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
}

export async function createMaintenanceAsset(input: CreateMaintenanceAssetInput): Promise<MaintenanceAsset> {
  const res = await api.post("/assets/maintenance", input);
  return res.data;
}

export interface CreateITAssetInput {
  name: string;
  category: string;
  serialNumber?: string;
  vendor?: string;
  ipAddress?: string;
  macAddress?: string;
  costCenter?: string;
  specifications?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  licenseExpiryDate?: string;
}

export async function createITAsset(input: CreateITAssetInput): Promise<ITAsset> {
  const res = await api.post("/assets/it", input);
  return res.data;
}

export async function uploadMaintenanceAssetPhoto(id: string, uri: string, fileName: string, mimeType: string): Promise<void> {
  const form = new FormData();
  form.append("photos", { uri, name: fileName, type: mimeType } as unknown as Blob);
  await api.post(`/assets/maintenance/${id}/photos`, form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function uploadAssetInvoice(
  type: AssetType,
  id: string,
  uri: string,
  fileName: string,
  mimeType: string,
  invoiceNumber?: string,
  amount?: number
): Promise<void> {
  const form = new FormData();
  form.append("file", { uri, name: fileName, type: mimeType } as unknown as Blob);
  if (invoiceNumber) form.append("invoiceNumber", invoiceNumber);
  if (amount != null) form.append("amount", String(amount));
  await api.post(`${basePath(type)}/${id}/invoices`, form, { headers: { "Content-Type": "multipart/form-data" } });
}
