import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { formatIST } from "@/lib/formatIST";

interface DateFieldProps {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, date: Date | undefined) {
    setOpen(false);
    if (event.type === "dismissed" || !date) return;
    onChange(date);
  }

  return (
    <View>
      {label && <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-soliflex-gray-200 px-3 py-3"
      >
        <Text className={`text-sm ${value ? "text-soliflex-ink" : "text-soliflex-gray-400"}`}>
          {value ? formatIST(value, "dd MMM yyyy") : "Select date"}
        </Text>
        <Calendar color="#9A9DA6" size={18} />
      </Pressable>
      {open && <DateTimePicker value={value ?? new Date()} mode="date" onChange={handleChange} />}
    </View>
  );
}
