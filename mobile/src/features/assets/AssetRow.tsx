import { Pressable, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import type { AssetStatus, ITAsset, MaintenanceAsset } from "@/lib/types";

const STATUS_COLORS: Record<AssetStatus, { bg: string; text: string }> = {
  ACTIVE: { bg: "#F0FDF4", text: "#15803D" },
  DOWN: { bg: "#FEF2F2", text: "#B91C1C" },
  RETIRED: { bg: "#F3F4F6", text: "#6B7280" },
};

interface AssetRowProps {
  asset: MaintenanceAsset | ITAsset;
  onPress: () => void;
}

export function AssetRow({ asset, onPress }: AssetRowProps) {
  const colors = STATUS_COLORS[asset.status];
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-xs font-semibold text-soliflex-gray-500">{asset.itemCode}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-soliflex-ink">{asset.name}</Text>
        <Text className="mt-0.5 text-xs text-soliflex-gray-500">{asset.category.replace(/_/g, " ")}</Text>
      </View>
      <Badge label={asset.status} bg={colors.bg} text={colors.text} />
    </Pressable>
  );
}
