import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";

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

/**
 * An inline dropdown, not a second full-screen Modal stacked on top of
 * whatever Modal this field already lives in - two RN <Modal>s stacked (one
 * sliding up over another) renders unreliably on Android, and a FlatList
 * nested inside the outer Modal's ScrollView (the previous design) breaks
 * tap handling there too. Plain mapped rows in a bounded, scrollable View
 * that expands in place are fine for every option list in this app (none
 * are long enough to need virtualization).
 */
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
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between rounded-lg border border-soliflex-gray-200 px-3 py-3"
      >
        <Text className={`text-sm ${selected ? "text-soliflex-ink" : "text-soliflex-gray-400"}`}>
          {selected?.label ?? placeholder}
        </Text>
        {open ? <ChevronUp color="#9A9DA6" size={18} /> : <ChevronDown color="#9A9DA6" size={18} />}
      </Pressable>
      {open && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 224 }}
          className="mt-1 rounded-lg border border-soliflex-gray-100 bg-white"
        >
          {options.map((item, index) => (
            <Pressable
              key={item.value}
              onPress={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className={`flex-row items-center justify-between px-3 py-3 ${index < options.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}
            >
              <Text className="text-sm text-soliflex-ink">{item.label}</Text>
              {item.value === value && <Check color="#F26522" size={18} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
