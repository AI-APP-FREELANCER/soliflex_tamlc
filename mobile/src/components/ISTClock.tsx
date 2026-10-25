import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Clock } from "lucide-react-native";

/** Live IST clock, for reference only (e.g. on the ticket-creation modal). */
export function ISTClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <View className="flex-row items-center gap-1.5 rounded-lg bg-soliflex-gray-50 px-3 py-1.5">
      <Clock color="#9A9DA6" size={14} />
      <Text className="text-xs font-medium text-soliflex-gray-600">{formatted} IST</Text>
    </View>
  );
}
