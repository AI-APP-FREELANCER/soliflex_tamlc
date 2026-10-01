import { Text, View } from "react-native";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-8 py-16">
      <Text className="text-base font-semibold text-soliflex-ink">{title}</Text>
      {description && <Text className="mt-1 text-center text-sm text-soliflex-gray-500">{description}</Text>}
    </View>
  );
}
