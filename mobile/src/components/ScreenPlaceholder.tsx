import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

interface ScreenPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Placeholder for a module not yet built on mobile (see the phased build plan). */
export function ScreenPlaceholder({ title, description, icon: Icon }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-4 rounded-full bg-soliflex-orange-50 p-4">
          <Icon color="#F26522" size={32} />
        </View>
        <Text className="text-lg font-bold text-soliflex-ink">{title}</Text>
        <Text className="mt-2 text-center text-sm text-soliflex-gray-500">{description}</Text>
      </View>
    </SafeAreaView>
  );
}
