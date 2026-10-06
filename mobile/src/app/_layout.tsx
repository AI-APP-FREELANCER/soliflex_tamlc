import "react-native-gesture-handler";
import "../global.css";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "@/lib/queryClient";
import { bootstrapSession } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    bootstrapSession().finally(() => setHydrated(true));
  }, [setHydrated]);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#F26522" />
      </View>
    );
  }
  return <>{children}</>;
}

function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user && !user.mustResetPassword}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !!user.mustResetPassword}>
        <Stack.Screen name="force-password" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthBootstrap>
            <RootNavigator />
          </AuthBootstrap>
          <StatusBar style="dark" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
