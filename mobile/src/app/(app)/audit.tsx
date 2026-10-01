import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditEntityTypes, fetchAuditLog } from "@/api/audit";
import { SelectField } from "@/components/SelectField";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { formatIST } from "@/lib/formatIST";
import type { DateRangeValue } from "@/lib/types";

export default function AuditScreen() {
  const [entityType, setEntityType] = useState<string | undefined>();
  const [range, setRange] = useState<DateRangeValue>({});
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const page = cursors.length - 1;

  const { data: entityTypes } = useQuery({ queryKey: ["audit-entity-types"], queryFn: fetchAuditEntityTypes });
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", entityType, range, cursors[page]],
    queryFn: () => fetchAuditLog({ entityType, ...range, cursor: cursors[page], limit: 50 }),
  });

  function resetPaging() {
    setCursors([undefined]);
  }

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <Text className="text-lg font-bold text-soliflex-ink">Audit Log</Text>
      </View>

      <View className="gap-3 border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <SelectField
          placeholder="All entity types"
          value={entityType}
          options={(entityTypes ?? []).map((t) => ({ value: t, label: t }))}
          onChange={(v) => {
            setEntityType(v);
            resetPaging();
          }}
        />
        <DateRangeFilter
          value={range}
          onChange={(v) => {
            setRange(v);
            resetPaging();
          }}
        />
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={data?.entries ?? []}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<EmptyState title="No audit entries found" />}
          renderItem={({ item }) => (
            <View className="border-b border-soliflex-gray-100 bg-white px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-soliflex-gray-500">{formatIST(item.changedAt, "dd MMM yyyy, HH:mm:ss")}</Text>
                <Text className="text-xs font-semibold text-soliflex-ink">{item.action}</Text>
              </View>
              <Text className="mt-1 text-sm text-soliflex-ink">{item.changedBy?.name ?? "—"}</Text>
              <Text className="text-xs text-soliflex-gray-500">
                {item.entityType} · {item.entityId}
              </Text>
              {item.field && (
                <Text className="mt-1 text-xs text-soliflex-gray-600">
                  {item.field}: {item.oldValue ?? "—"} → {item.newValue ?? "—"}
                </Text>
              )}
            </View>
          )}
          ListFooterComponent={
            <View className="flex-row gap-2 p-4">
              <View className="flex-1">
                <Button
                  title="Previous"
                  variant="outline"
                  disabled={page === 0}
                  onPress={() => setCursors((c) => c.slice(0, -1))}
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Next"
                  variant="outline"
                  disabled={!data?.nextCursor}
                  onPress={() => setCursors((c) => [...c, data?.nextCursor ?? undefined])}
                />
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
