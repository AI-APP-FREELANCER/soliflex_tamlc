import { Pressable, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import type { User } from "@/lib/types";

interface UserRowProps {
  user: User;
  onPress: () => void;
}

export function UserRow({ user, onPress }: UserRowProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-soliflex-ink">{user.name}</Text>
        <Text className="text-xs text-soliflex-gray-500">{[user.email, user.phone].filter(Boolean).join(" · ")}</Text>
        <Text className="mt-0.5 text-xs text-soliflex-gray-500">
          {user.role}
          {user.workstream ? ` · ${user.workstream}` : ""}
        </Text>
      </View>
      <Badge label={user.active ? "Active" : "Inactive"} bg={user.active ? "#F0FDF4" : "#F3F4F6"} text={user.active ? "#15803D" : "#6B7280"} />
    </Pressable>
  );
}
