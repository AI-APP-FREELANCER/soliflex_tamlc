import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { TextField } from "@/components/TextField";

interface CategoryFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}

/**
 * Free-text input with tappable suggestion chips — the RN equivalent of the
 * web app's `<input list><datalist>` combo (no native datalist on mobile).
 * Categories are deliberately free text server-side, not a fixed enum.
 */
export function CategoryField({ label = "Category", value, onChange, suggestions }: CategoryFieldProps) {
  const unique = useMemo(() => Array.from(new Set(suggestions)).sort(), [suggestions]);

  return (
    <View>
      <TextField
        label={label}
        placeholder="e.g. PRODUCTION_MACHINE"
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/\s+/g, "_"))}
        autoCapitalize="characters"
      />
      {unique.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row gap-2">
            {unique.map((c) => {
              const active = c === value;
              return (
                <Pressable
                  key={c}
                  onPress={() => onChange(c)}
                  className={`rounded-full border px-3 py-1.5 ${
                    active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200 bg-white"
                  }`}
                >
                  <Text className={`text-xs font-medium ${active ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
