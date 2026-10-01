import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/notifications";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { formatIST } from "@/lib/formatIST";
import type { AppNotification } from "@/lib/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function handlePress(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) router.push(n.link as never);
  }

  const unreadCount = (data ?? []).filter((n) => !n.read).length;

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: "Notifications" }} />
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <Text className="text-lg font-bold text-soliflex-ink">Notifications</Text>
        {unreadCount > 0 && (
          <Button title="Mark all read" variant="outline" onPress={() => markAllRead.mutate()} loading={markAllRead.isPending} />
        )}
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(n) => n.id}
          ListEmptyComponent={<EmptyState title="No notifications" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              className={`border-b border-soliflex-gray-100 px-4 py-3 ${item.read ? "bg-white" : "bg-soliflex-orange-50"}`}
            >
              <Text className="text-sm text-soliflex-ink">{item.message}</Text>
              <Text className="mt-1 text-xs text-soliflex-gray-500">{formatIST(item.createdAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
