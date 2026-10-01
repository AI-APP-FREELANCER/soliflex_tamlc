import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { Modal } from "@/components/Modal";

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface SelectFieldProps<T extends string> {
  label?: string;
  placeholder?: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      {label && <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-soliflex-gray-200 px-3 py-3"
      >
        <Text className={`text-sm ${selected ? "text-soliflex-ink" : "text-soliflex-gray-400"}`}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown color="#9A9DA6" size={18} />
      </Pressable>
      <Modal visible={open} title={label ?? "Select"} onClose={() => setOpen(false)}>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-3"
            >
              <Text className="text-sm text-soliflex-ink">{item.label}</Text>
              {item.value === value && <Check color="#F26522" size={18} />}
            </Pressable>
          )}
        />
      </Modal>
    </View>
  );
}
