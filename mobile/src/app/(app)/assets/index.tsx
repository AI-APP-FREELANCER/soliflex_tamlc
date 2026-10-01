import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, QrCode } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { useAssets } from "@/features/assets/hooks";
import { canCreateAsset } from "@/features/assets/permissions";
import { AssetRow } from "@/features/assets/AssetRow";
import { CreateMaintenanceAssetModal } from "@/features/assets/CreateMaintenanceAssetModal";
import { CreateITAssetModal } from "@/features/assets/CreateITAssetModal";
import { QrScannerModal } from "@/components/QrScannerModal";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/TextField";
import { fetchAssets } from "@/api/assets";
import type { AssetType } from "@/lib/types";

function defaultType(role: string | undefined): AssetType {
  return role === "IT_TEAM" ? "it" : "maintenance";
}

export default function AssetsListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState<AssetType>(defaultType(user?.role));
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: assets, isLoading } = useAssets(type, { search: search || undefined });

  const canCreate = useMemo(() => canCreateAsset(user?.role, type), [user?.role, type]);

  async function handleScan(itemCode: string) {
    try {
      const results = await fetchAssets(type, { search: itemCode });
      const exact = results.find((a) => a.itemCode === itemCode) ?? results[0];
      if (exact) {
        router.push(`/assets/${type}/${exact.id}`);
      } else {
        Alert.alert("Not found", `No ${type === "maintenance" ? "maintenance" : "IT"} asset matches code "${itemCode}". Try switching the tab.`);
      }
    } catch {
      Alert.alert("Something went wrong", "Could not look up that QR code. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <Text className="text-lg font-bold text-soliflex-ink">Assets</Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setScannerOpen(true)} hitSlop={8}>
            <QrCode color="#23272B" size={22} />
          </Pressable>
          {canCreate && (
            <Pressable onPress={() => setCreateOpen(true)} className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2">
              <Plus color="#fff" size={16} />
              <Text className="text-xs font-semibold text-white">Add</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="gap-3 border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <View className="flex-row gap-2">
          {(["maintenance", "it"] as AssetType[]).map((t) => {
            const active = type === t;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                className={`flex-1 items-center rounded-lg border py-2 ${
                  active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200"
                }`}
              >
                <Text className={`text-xs font-semibold ${active ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
                  {t === "maintenance" ? "Maintenance" : "IT"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextField placeholder="Search name or item code" value={search} onChangeText={setSearch} />
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={assets ?? []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <AssetRow asset={item} onPress={() => router.push(`/assets/${type}/${item.id}`)} />}
          ListEmptyComponent={<EmptyState title="No assets found" description="Try a different search or add a new asset." />}
        />
      )}

      {type === "maintenance" ? (
        <CreateMaintenanceAssetModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(`/assets/maintenance/${id}`)}
        />
      ) : (
        <CreateITAssetModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(`/assets/it/${id}`)}
        />
      )}
      <QrScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScan} />
    </SafeAreaView>
  );
}
