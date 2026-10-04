import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight } from "lucide-react-native";
import { fetchNotifications } from "@/api/notifications";
import * as auth from "@/api/auth";
import { apiErrorMessage } from "@/lib/api-client";
import { getStoredRefreshToken, clearStoredRefreshToken } from "@/lib/secureStore";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-3">
      <Text className="text-sm text-soliflex-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-soliflex-ink">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: notifications } = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, refetchInterval: 30000 });
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const clearSession = useAuthStore((s) => s.clearSession);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: () => auth.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setMessage({ type: "success", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err) => setMessage({ type: "error", text: apiErrorMessage(err) }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = await getStoredRefreshToken();
      await auth.logout(refreshToken);
    },
    onSettled: async () => {
      await clearStoredRefreshToken();
      clearSession();
    },
  });

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center border-b border-soliflex-gray-100 bg-white px-1 py-1">
        <DrawerToggleButton tintColor="#23272B" />
        <Text className="text-lg font-bold text-soliflex-ink">Profile</Text>
      </View>
      <ScrollView contentContainerClassName="px-5 py-5" keyboardShouldPersistTaps="handled">
        <View className="items-center py-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-soliflex-orange-500">
            <Text className="text-xl font-bold text-white">{user.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text className="mt-3 text-lg font-bold text-soliflex-ink">{user.name}</Text>
          <Text className="text-sm text-soliflex-gray-500">{user.email}</Text>
        </View>

        <Pressable
          onPress={() => router.push("/profile/notifications")}
          className="mb-4 flex-row items-center justify-between rounded-xl border border-soliflex-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-row items-center gap-2">
            <Bell color="#23272B" size={18} />
            <Text className="text-sm font-medium text-soliflex-ink">Notifications</Text>
            {unreadCount > 0 && (
              <View className="rounded-full bg-soliflex-orange-500 px-2 py-0.5">
                <Text className="text-xs font-semibold text-white">{unreadCount}</Text>
              </View>
            )}
          </View>
          <ChevronRight color="#9A9DA6" size={18} />
        </Pressable>

        <View className="rounded-xl border border-soliflex-gray-100 bg-white px-4">
          <InfoRow label="Role" value={user.role} />
          <InfoRow label="Employee ID" value={user.employeeId} />
          <InfoRow label="Workstream" value={user.workstream ?? "—"} />
          <InfoRow label="Department" value={user.department ?? "—"} />
        </View>

        <Text className="mb-3 mt-6 text-sm font-bold text-soliflex-ink">Change password</Text>
        <View className="gap-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <TextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          {message && (
            <Text className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>{message.text}</Text>
          )}
          <Button
            title="Update password"
            variant="secondary"
            loading={changePasswordMutation.isPending}
            disabled={!currentPassword || !newPassword}
            onPress={() => {
              setMessage(null);
              changePasswordMutation.mutate();
            }}
          />
        </View>

        <View className="mt-6">
          <Button title="Sign out" variant="outline" loading={logoutMutation.isPending} onPress={() => logoutMutation.mutate()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
