import { useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { FileText } from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/store/auth.store";
import { useAsset, useAssetMutations } from "@/features/assets/hooks";
import { canCreateAsset } from "@/features/assets/permissions";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Spinner } from "@/components/Spinner";
import { formatIST } from "@/lib/formatIST";
import { API_BASE_URL } from "@/lib/env";
import type { AssetStatus, AssetType, ITAsset, MaintenanceAsset } from "@/lib/types";

const STATUS_COLORS: Record<AssetStatus, { bg: string; text: string }> = {
  ACTIVE: { bg: "#F0FDF4", text: "#15803D" },
  DOWN: { bg: "#FEF2F2", text: "#B91C1C" },
  RETIRED: { bg: "#F3F4F6", text: "#6B7280" },
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="w-1/2 py-2 pr-2">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className="mt-0.5 text-sm font-medium text-soliflex-ink">{value}</Text>
    </View>
  );
}

export default function AssetDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: AssetType; id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: asset, isLoading } = useAsset(type, id);
  const { uploadPhoto, uploadInvoice } = useAssetMutations(type, id);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");

  const canEdit = canCreateAsset(user?.role, type);

  if (isLoading || !asset) {
    return (
      <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
        <Stack.Screen options={{ title: "Asset" }} />
        <Spinner />
      </SafeAreaView>
    );
  }

  const isMaintenance = type === "maintenance";
  const m = asset as MaintenanceAsset;
  const it = asset as ITAsset;
  const colors = STATUS_COLORS[asset.status];
  const assetId = asset.id;

  async function handlePhotoUpload(source: "camera" | "library") {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to attach a photo.");
      return;
    }
    const result = source === "camera" ? await ImagePicker.launchCameraAsync({ quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    uploadPhoto.mutate({ assetId, uri: a.uri, fileName: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg" });
  }

  async function handleInvoiceUpload() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"] });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    uploadInvoice.mutate(
      {
        assetType: type,
        assetId,
        uri: a.uri,
        fileName: a.name,
        mimeType: a.mimeType ?? "application/octet-stream",
        invoiceNumber: invoiceNumber.trim() || undefined,
        amount: invoiceAmount ? Number(invoiceAmount) : undefined,
      },
      { onSuccess: () => { setInvoiceNumber(""); setInvoiceAmount(""); } }
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: asset.itemCode }} />
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-soliflex-gray-500">{asset.itemCode}</Text>
            <Badge label={asset.status} bg={colors.bg} text={colors.text} />
          </View>
          <Text className="mt-1 text-base font-bold text-soliflex-ink">{asset.name}</Text>
          <Text className="mt-0.5 text-xs text-soliflex-gray-500">{asset.category.replace(/_/g, " ")}</Text>
          {asset.status === "DOWN" && asset.statusSince && (
            <Text className="mt-2 text-xs font-medium text-red-600">
              Down since {formatDistanceToNow(new Date(asset.statusSince), { addSuffix: true })}
            </Text>
          )}
          {asset.specifications && <Text className="mt-2 text-sm text-soliflex-gray-700">{asset.specifications}</Text>}
        </View>

        {asset.qrCodeUrl && (
          <View className="mt-3 items-center rounded-xl border border-soliflex-gray-100 bg-white p-4">
            <Image source={{ uri: `${API_BASE_URL}${asset.qrCodeUrl}` }} style={{ width: 160, height: 160 }} resizeMode="contain" />
          </View>
        )}

        <View className="mt-3 flex-row flex-wrap rounded-xl border border-soliflex-gray-100 bg-white p-4">
          {isMaintenance ? (
            <>
              <Field label="Model" value={m.model} />
              <Field label="Manufacturer" value={m.manufacturer} />
              <Field label="Plant location" value={m.plantLocation} />
              <Field label="Warranty end" value={m.warrantyEndDate ? formatIST(m.warrantyEndDate, "dd MMM yyyy") : null} />
            </>
          ) : (
            <>
              <Field label="Serial number" value={it.serialNumber} />
              <Field label="Vendor" value={it.vendor} />
              <Field label="IP address" value={it.ipAddress} />
              <Field label="MAC address" value={it.macAddress} />
              <Field label="Cost center" value={it.costCenter} />
              <Field label="Warranty end" value={it.warrantyEndDate ? formatIST(it.warrantyEndDate, "dd MMM yyyy") : null} />
              <Field label="License expiry" value={it.licenseExpiryDate ? formatIST(it.licenseExpiryDate, "dd MMM yyyy") : null} />
            </>
          )}
        </View>

        {isMaintenance && (
          <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
            <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Photos</Text>
            {canEdit && (
              <View className="mb-3 flex-row gap-2">
                <View className="flex-1">
                  <Button title="Take photo" variant="secondary" onPress={() => handlePhotoUpload("camera")} loading={uploadPhoto.isPending} />
                </View>
                <View className="flex-1">
                  <Button title="Choose photo" variant="outline" onPress={() => handlePhotoUpload("library")} loading={uploadPhoto.isPending} />
                </View>
              </View>
            )}
            {m.photos?.length ? (
              <View className="flex-row flex-wrap gap-2">
                {m.photos.map((p) => (
                  <Pressable key={p.id} onPress={() => Linking.openURL(`${API_BASE_URL}${p.fileUrl}`)}>
                    <Image source={{ uri: `${API_BASE_URL}${p.fileUrl}` }} style={{ width: 72, height: 72, borderRadius: 8 }} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-soliflex-gray-500">No photos yet.</Text>
            )}
          </View>
        )}

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Vendor invoices</Text>
          {asset.invoices?.length ? (
            asset.invoices.map((inv) => (
              <Pressable
                key={inv.id}
                onPress={() => Linking.openURL(`${API_BASE_URL}${inv.fileUrl}`)}
                className="flex-row items-center gap-2 border-b border-soliflex-gray-50 py-2"
              >
                <FileText color="#9A9DA6" size={18} />
                <Text className="flex-1 text-sm text-soliflex-ink">{inv.invoiceNumber ?? "Invoice"}</Text>
                {inv.amount != null && <Text className="text-sm text-soliflex-gray-600">₹{inv.amount.toLocaleString("en-IN")}</Text>}
              </Pressable>
            ))
          ) : (
            <Text className="text-sm text-soliflex-gray-500">No invoices yet.</Text>
          )}
          {canEdit && (
            <View className="mt-3 gap-2">
              <TextField placeholder="Invoice number (optional)" value={invoiceNumber} onChangeText={setInvoiceNumber} />
              <TextField placeholder="Amount (optional)" value={invoiceAmount} onChangeText={setInvoiceAmount} keyboardType="numeric" />
              <Button title="Upload invoice" variant="secondary" onPress={handleInvoiceUpload} loading={uploadInvoice.isPending} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
