import { Stack } from "expo-router";

// Nests the Helpdesk list/detail/dashboard screens under one Stack so the
// outer Drawer only ever sees a single "helpdesk" item, instead of each
// file here leaking out as its own sibling drawer entry.
export default function HelpdeskLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="dashboard" />
    </Stack>
  );
}
