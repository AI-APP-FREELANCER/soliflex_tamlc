import { Text, View } from "react-native";

interface BadgeProps {
  label: string;
  bg: string;
  text: string;
}

export function Badge({ label, bg, text }: BadgeProps) {
  return (
    <View style={{ backgroundColor: bg }} className="self-start rounded-full px-2.5 py-1">
      <Text style={{ color: text }} className="text-xs font-semibold">
        {label}
      </Text>
    </View>
  );
}
