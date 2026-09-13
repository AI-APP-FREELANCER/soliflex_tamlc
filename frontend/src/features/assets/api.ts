import { api } from "../../lib/api";
import type { ITAsset, ITAssetCategory, MaintenanceAsset, MaintenanceAssetCategory } from "../../lib/types";

export async function fetchMaintenanceAssets(search?: string): Promise<MaintenanceAsset[]> {
  const res = await api.get("/assets/maintenance", { params: search ? { search } : {} });
  return res.data;
}

export async function fetchMaintenanceAsset(id: string): Promise<MaintenanceAsset> {
  const res = await api.get(`/assets/maintenance/${id}`);
  return res.data;
}

export async function fetchMaintenanceAssetCategories(): Promise<string[]> {
  const res = await api.get("/assets/maintenance/categories");
  return res.data;
}

export interface CreateMaintenanceAssetInput {
  name: string;
  category: MaintenanceAssetCategory;
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

export async function uploadMaintenanceAssetPhotos(id: string, files: File[], caption?: string) {
  const form = new FormData();
  files.forEach((f) => form.append("photos", f));
  if (caption) form.append("caption", caption);
  const res = await api.post(`/assets/maintenance/${id}/photos`, form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export async function downloadMaintenanceAssetTemplate() {
  const res = await api.get("/assets/maintenance/template", { responseType: "blob" });
  return res.data as Blob;
}

export async function bulkImportMaintenanceAssets(file: File): Promise<BulkImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/assets/maintenance/bulk-import", form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export async function uploadMaintenanceAssetInvoice(id: string, file: File, invoiceNumber?: string, amount?: number) {
  const form = new FormData();
  form.append("file", file);
  if (invoiceNumber) form.append("invoiceNumber", invoiceNumber);
  if (amount !== undefined) form.append("amount", String(amount));
  const res = await api.post(`/assets/maintenance/${id}/invoices`, form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export async function fetchITAssets(search?: string): Promise<ITAsset[]> {
  const res = await api.get("/assets/it", { params: search ? { search } : {} });
  return res.data;
}

export async function fetchITAsset(id: string): Promise<ITAsset> {
  const res = await api.get(`/assets/it/${id}`);
  return res.data;
}

export async function fetchITAssetCategories(): Promise<string[]> {
  const res = await api.get("/assets/it/categories");
  return res.data;
}

export interface CreateITAssetInput {
  name: string;
  category: ITAssetCategory;
  serialNumber?: string;
  specifications?: string;
  ipAddress?: string;
  macAddress?: string;
  vendor?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  licenseExpiryDate?: string;
  costCenter?: string;
}

export async function createITAsset(input: CreateITAssetInput): Promise<ITAsset> {
  const res = await api.post("/assets/it", input);
  return res.data;
}

export async function downloadITAssetTemplate() {
  const res = await api.get("/assets/it/template", { responseType: "blob" });
  return res.data as Blob;
}

export async function bulkImportITAssets(file: File): Promise<BulkImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/assets/it/bulk-import", form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

export async function uploadITAssetInvoice(id: string, file: File, invoiceNumber?: string, amount?: number) {
  const form = new FormData();
  form.append("file", file);
  if (invoiceNumber) form.append("invoiceNumber", invoiceNumber);
  if (amount !== undefined) form.append("amount", String(amount));
  const res = await api.post(`/assets/it/${id}/invoices`, form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}
