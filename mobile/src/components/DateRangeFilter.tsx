import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { DateRangePreset, DateRangeValue } from "@/lib/types";

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: "Today", value: "today" },
  { label: "This week", value: "this_week" },
  { label: "MTD", value: "mtd" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "Custom", value: "custom" },
];

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [picking, setPicking] = useState<"from" | "to" | null>(null);

  function handlePick(event: DateTimePickerEvent, date: Date | undefined) {
    const field = picking;
    setPicking(null);
    if (event.type === "dismissed" || !date || !field) return;
    onChange({ ...value, range: "custom", [field]: toYmd(date) });
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row gap-2">
          {PRESETS.map((p) => {
            const active = value.range === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => onChange({ range: p.value, from: value.from, to: value.to })}
                className={`rounded-full border px-3 py-1.5 ${
                  active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200 bg-white"
                }`}
              >
                <Text className={`text-xs font-medium ${active ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {value.range === "custom" && (
        <View className="mt-2 flex-row gap-2">
          <Pressable
            onPress={() => setPicking("from")}
            className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2"
          >
            <Text className="text-xs text-soliflex-gray-500">From</Text>
            <Text className="text-sm text-soliflex-ink">{value.from ?? "Select"}</Text>
          </Pressable>
          <Pressable
            onPress={() => setPicking("to")}
            className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2"
          >
            <Text className="text-xs text-soliflex-gray-500">To</Text>
            <Text className="text-sm text-soliflex-ink">{value.to ?? "Select"}</Text>
          </Pressable>
        </View>
      )}
      {picking && (
        <DateTimePicker
          value={(picking === "from" ? value.from && new Date(value.from) : value.to && new Date(value.to)) || new Date()}
          mode="date"
          onChange={handlePick}
        />
      )}
    </View>
  );
}
