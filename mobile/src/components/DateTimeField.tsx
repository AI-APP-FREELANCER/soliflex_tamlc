import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarClock } from "lucide-react-native";
import { formatIST } from "@/lib/formatIST";

interface DateTimeFieldProps {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

/**
 * Android's native picker only supports one mode (date OR time) per dialog,
 * so we chain date -> time there; iOS shows a single combined spinner.
 */
export function DateTimeField({ label, value, onChange, minimumDate }: DateTimeFieldProps) {
  const [stage, setStage] = useState<"none" | "date" | "time">("none");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  function openPicker() {
    setStage("date");
  }

  function handleChange(event: DateTimePickerEvent, picked: Date | undefined) {
    if (event.type === "dismissed" || !picked) {
      setStage("none");
      return;
    }
    if (Platform.OS === "android") {
      if (stage === "date") {
        setPendingDate(picked);
        setStage("time");
        return;
      }
      if (stage === "time" && pendingDate) {
        const combined = new Date(pendingDate);
        combined.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        onChange(combined);
        setStage("none");
        setPendingDate(null);
        return;
      }
    } else {
      onChange(picked);
      setStage("none");
    }
  }

  return (
    <View>
      {label && <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>}
      <Pressable
        onPress={openPicker}
        className="flex-row items-center justify-between rounded-lg border border-soliflex-gray-200 px-3 py-3"
      >
        <Text className={`text-sm ${value ? "text-soliflex-ink" : "text-soliflex-gray-400"}`}>
          {value ? formatIST(value, "dd MMM yyyy, HH:mm") + " IST" : "Select date & time"}
        </Text>
        <CalendarClock color="#9A9DA6" size={18} />
      </Pressable>
      {stage !== "none" && (
        <DateTimePicker
          value={stage === "time" && pendingDate ? pendingDate : value ?? new Date()}
          mode={Platform.OS === "android" ? stage : "datetime"}
          is24Hour
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}
