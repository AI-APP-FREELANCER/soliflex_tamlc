import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as auth from "@/api/auth";
import { apiErrorMessage } from "@/lib/api-client";
import { clearStoredRefreshToken, getStoredRefreshToken } from "@/lib/secureStore";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

/** Shown instead of the app while the account still uses a temporary password. */
export default function ForcePasswordScreen() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async () => {
      await auth.changePassword(currentPassword, newPassword);
      const me = await auth.fetchMe();
      const token = useAuthStore.getState().accessToken;
      if (token) useAuthStore.getState().setSession(token, me); // unlocks the app
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const refreshToken = await getStoredRefreshToken();
      await auth.logout(refreshToken);
    },
    onSettled: async () => {
      await clearStoredRefreshToken();
      clearSession();
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-5 py-8" keyboardShouldPersistTaps="handled">
          <Text className="text-xl font-bold text-soliflex-ink">Set a new password</Text>
          <View className="mt-3 rounded-lg bg-amber-50 p-3">
            <Text className="text-sm text-amber-800">
              You are signed in with a temporary password. Please choose your own password to continue.
            </Text>
          </View>
          <View className="mt-4 gap-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
            <TextField label="Temporary password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
            <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
            <Text className="text-xs text-soliflex-gray-500">At least 10 characters with upper and lower case letters, a number and a symbol.</Text>
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            <Button
              title="Update password"
              loading={change.isPending}
              disabled={!currentPassword || newPassword.length < 10}
              onPress={() => {
                setError(null);
                change.mutate();
              }}
            />
          </View>
          <View className="mt-4">
            <Button title="Sign out" variant="outline" loading={signOut.isPending} onPress={() => signOut.mutate()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
