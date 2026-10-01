import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react-native";
import { TextField } from "@/components/TextField";
import { QrScannerModal } from "@/components/QrScannerModal";
import { fetchAssets } from "@/api/assets";
import type { AssetType } from "@/lib/types";

interface AssetPickerProps {
  type: AssetType;
  label?: string;
  selectedLabel?: string;
  onSelect: (assetId: string, label: string) => void;
  onClear: () => void;
}

/** Optional asset link for a ticket — mirrors the web create-ticket form's
 * search-and-pick flow, plus a QR-scan shortcut (no web precedent for the
 * scan jumping straight into this field, but it's the natural mobile UX). */
export function AssetPicker({ type, label = "Link an asset (optional)", selectedLabel, onSelect, onClear }: AssetPickerProps) {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { data: results } = useQuery({
    queryKey: ["asset-picker", type, search],
    queryFn: () => fetchAssets(type, { search }),
    enabled: search.length > 1,
  });

  if (selectedLabel) {
    return (
      <View>
        <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>
        <View className="flex-row items-center justify-between rounded-lg border border-soliflex-orange-200 bg-soliflex-orange-50 px-3 py-3">
          <Text className="flex-1 text-sm text-soliflex-ink">{selectedLabel}</Text>
          <Pressable onPress={onClear}>
            <Text className="text-xs font-semibold text-soliflex-orange-600">Clear</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>
        <Pressable onPress={() => setScannerOpen(true)} hitSlop={8}>
          <QrCode color="#23272B" size={18} />
        </Pressable>
      </View>
      <TextField placeholder="Search by name or item code" value={search} onChangeText={setSearch} />
      {!!results?.length && (
        <View className="mt-2 rounded-lg border border-soliflex-gray-100 bg-white">
          {results.slice(0, 6).map((a, idx, arr) => (
            <Pressable
              key={a.id}
              onPress={() => {
                onSelect(a.id, `${a.itemCode} — ${a.name}`);
                setSearch("");
              }}
              className={`px-3 py-2 ${idx < arr.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}
            >
              <Text className="text-sm text-soliflex-ink">
                {a.itemCode} — {a.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => setSearch(code)}
      />
    </View>
  );
}
