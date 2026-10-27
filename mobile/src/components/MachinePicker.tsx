import { useState } from "react";
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { TextField } from "@/components/TextField";
import { fetchMachinePicker } from "@/api/assets";
import type { MachineSummary } from "@/lib/types";

interface MachinePickerProps {
  value: MachineSummary | null;
  onChange: (machine: MachineSummary | null) => void;
}

/**
 * Searchable, paginated "Machine Name" picker for the new-ticket form -
 * loads a page of maintenance assets at a time, fetching more as the
 * list is scrolled rather than pulling the whole asset list at once.
 */
export function MachinePicker({ value, onChange }: MachinePickerProps) {
  const [search, setSearch] = useState("");
  const open = search.length > 0 && !value;

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["machine-picker", search],
    queryFn: ({ pageParam }) => fetchMachinePicker({ search, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: open,
  });
  const machines = data?.pages.flatMap((p) => p.items) ?? [];

  function onListScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (isFetchingNextPage || !hasNextPage) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentSize.height - contentOffset.y - layoutMeasurement.height < 60) fetchNextPage();
  }

  if (value) {
    return (
      <View>
        <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">Machine Name</Text>
        <View className="flex-row items-center justify-between rounded-lg border border-soliflex-orange-200 bg-soliflex-orange-50 px-3 py-3">
          <Text className="flex-1 text-sm text-soliflex-ink">
            {value.name} ({value.itemCode})
          </Text>
          <Pressable onPress={() => onChange(null)}>
            <Text className="text-xs font-semibold text-soliflex-orange-600">Clear</Text>
          </Pressable>
        </View>
        {(value.model || value.manufacturer || value.powerCapacity) && (
          <View className="mt-2 rounded-lg bg-soliflex-gray-50 px-3 py-2">
            <Text className="mb-1 text-xs font-semibold text-soliflex-gray-500">Machine details</Text>
            {value.model && <Text className="text-xs text-soliflex-gray-600">Model: {value.model}</Text>}
            {value.manufacturer && <Text className="text-xs text-soliflex-gray-600">Manufacturer: {value.manufacturer}</Text>}
            {value.powerCapacity && <Text className="text-xs text-soliflex-gray-600">Power capacity: {value.powerCapacity}</Text>}
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      <TextField label="Machine Name" placeholder="Search machine by name or item code" value={search} onChangeText={setSearch} />
      {open && (
        <View className="mt-2 max-h-56 rounded-lg border border-soliflex-gray-100 bg-white">
          {isLoading && (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator size="small" />
              <Text className="text-xs text-soliflex-gray-400">Loading machines…</Text>
            </View>
          )}
          {!isLoading && machines.length === 0 && <Text className="px-3 py-3 text-xs text-soliflex-gray-400">No machines found</Text>}
          {machines.length > 0 && (
            // A plain ScrollView, not a FlatList - this dropdown sits inside the
            // create-ticket Modal's own ScrollView, and a VirtualizedList (FlatList)
            // nested inside another ScrollView breaks tap handling on Android (list
            // items render but onPress never fires). The list is small and paginated
            // (20 at a time), so skipping virtualization here is fine.
            <ScrollView keyboardShouldPersistTaps="handled" onScroll={onListScroll} scrollEventThrottle={100} style={{ maxHeight: 224 }}>
              {machines.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onChange(item);
                    setSearch("");
                  }}
                  className={`px-3 py-2 ${index < machines.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}
                >
                  <Text className="text-sm text-soliflex-ink">
                    {item.name} <Text className="text-xs text-soliflex-gray-400">{item.itemCode}</Text>
                  </Text>
                  <Text className="text-xs text-soliflex-gray-400">
                    {item.category}
                    {item.plantLocation ? ` · ${item.plantLocation}` : ""}
                  </Text>
                </Pressable>
              ))}
              {isFetchingNextPage && (
                <View className="flex-row items-center justify-center gap-2 py-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-xs text-soliflex-gray-400">Loading more…</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
