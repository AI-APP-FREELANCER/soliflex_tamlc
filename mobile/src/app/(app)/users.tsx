import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerToggleButton } from "expo-router/drawer";
import { Plus } from "lucide-react-native";
import { useUsersList } from "@/features/users/hooks";
import { UserRow } from "@/features/users/UserRow";
import { CreateUserModal } from "@/features/users/CreateUserModal";
import { EditUserModal } from "@/features/users/EditUserModal";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import type { User } from "@/lib/types";

export default function UsersScreen() {
  const { data: users, isLoading } = useUsersList();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white py-1 pl-1 pr-4">
        <View className="flex-row items-center">
          <DrawerToggleButton tintColor="#23272B" />
          <Text className="text-lg font-bold text-soliflex-ink">Users</Text>
        </View>
        <Pressable onPress={() => setCreateOpen(true)} className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2">
          <Plus color="#fff" size={16} />
          <Text className="text-xs font-semibold text-white">Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} onPress={() => setEditUser(item)} />}
          ListEmptyComponent={<EmptyState title="No users found" />}
        />
      )}

      <CreateUserModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      {editUser && <EditUserModal visible user={editUser} onClose={() => setEditUser(null)} />}
    </SafeAreaView>
  );
}
