import { Stack } from "expo-router";

export default function AssetsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[type]/[id]" />
    </Stack>
  );
}
