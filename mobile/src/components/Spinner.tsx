import { ActivityIndicator, View } from "react-native";

export function Spinner() {
  return (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator color="#F26522" size="large" />
    </View>
  );
}
