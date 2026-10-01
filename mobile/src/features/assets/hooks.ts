import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-client";
import type { AssetFilter, AssetType } from "@/lib/types";
import {
  createITAsset,
  createMaintenanceAsset,
  fetchAsset,
  fetchAssetCategories,
  fetchAssets,
  uploadAssetInvoice,
  uploadMaintenanceAssetPhoto,
  type CreateITAssetInput,
  type CreateMaintenanceAssetInput,
} from "@/api/assets";

export function useAssets(type: AssetType, filter: AssetFilter) {
  return useQuery({
    queryKey: ["assets", type, filter],
    queryFn: () => fetchAssets(type, filter),
  });
}

export function useAssetCategories(type: AssetType) {
  return useQuery({ queryKey: ["asset-categories", type], queryFn: () => fetchAssetCategories(type) });
}

export function useAsset(type: AssetType, id: string | undefined) {
  return useQuery({
    queryKey: ["asset", type, id],
    queryFn: () => fetchAsset(type, id as string),
    enabled: !!id,
  });
}

function onErr(err: unknown) {
  Alert.alert("Something went wrong", apiErrorMessage(err));
}

export function useAssetMutations(type?: AssetType, id?: string) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["asset-categories"] });
    if (type && id) qc.invalidateQueries({ queryKey: ["asset", type, id] });
  }

  const createMaintenance = useMutation({
    mutationFn: (input: CreateMaintenanceAssetInput) => createMaintenanceAsset(input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const createIT = useMutation({
    mutationFn: (input: CreateITAssetInput) => createITAsset(input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const uploadPhoto = useMutation({
    mutationFn: ({ assetId, uri, fileName, mimeType }: { assetId: string; uri: string; fileName: string; mimeType: string }) =>
      uploadMaintenanceAssetPhoto(assetId, uri, fileName, mimeType),
    onSuccess: invalidate,
    onError: onErr,
  });

  const uploadInvoice = useMutation({
    mutationFn: ({
      assetType,
      assetId,
      uri,
      fileName,
      mimeType,
      invoiceNumber,
      amount,
    }: {
      assetType: AssetType;
      assetId: string;
      uri: string;
      fileName: string;
      mimeType: string;
      invoiceNumber?: string;
      amount?: number;
    }) => uploadAssetInvoice(assetType, assetId, uri, fileName, mimeType, invoiceNumber, amount),
    onSuccess: invalidate,
    onError: onErr,
  });

  return { createMaintenance, createIT, uploadPhoto, uploadInvoice };
}
