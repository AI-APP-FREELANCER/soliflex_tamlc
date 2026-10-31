import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerToggleButton } from "expo-router/drawer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { apiErrorMessage } from "@/lib/api-client";

export interface NamedItem {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  title: string;
  itemLabel: string;
  hint: string;
  placeholder: string;
  fetchAll: () => Promise<NamedItem[]>;
  create: (name: string) => Promise<NamedItem>;
  update: (id: string, data: { name?: string; active?: boolean }) => Promise<NamedItem>;
  remove: (id: string) => Promise<void>;
  queryKey: string;
}

/**
 * Mobile counterpart to the web app's NamedListAdminPage — same CRUD shape
 * (create, rename, activate/deactivate, type-to-confirm delete) for the
 * Plants / Departments / Designations admin screens.
 */
export function NamedListAdminScreen({ title, itemLabel, hint, placeholder, fetchAll, create, update, remove, queryKey }: Props) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: [queryKey, "all"], queryFn: fetchAll });

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<NamedItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState<NamedItem | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: [queryKey] });
  }
  function onErr(err: unknown) {
    Alert.alert("Something went wrong", apiErrorMessage(err));
  }

  const createM = useMutation({
    mutationFn: () => create(newName.trim()),
    onSuccess: () => {
      setNewName("");
      setAddOpen(false);
      invalidate();
    },
    onError: onErr,
  });

  const updateM = useMutation({
    mutationFn: (data: { name?: string; active?: boolean }) => update(editing!.id, data),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: onErr,
  });

  const deleteM = useMutation({
    mutationFn: () => remove(deleting!.id),
    onSuccess: () => {
      setDeleting(null);
      setDeleteTyped("");
      invalidate();
    },
    onError: onErr,
  });

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white py-1 pl-1 pr-4">
        <View className="flex-row items-center">
          <DrawerToggleButton tintColor="#23272B" />
          <Text className="text-lg font-bold text-soliflex-ink">{title}</Text>
        </View>
        <Pressable onPress={() => setAddOpen(true)} className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2">
          <Plus color="#fff" size={16} />
          <Text className="text-xs font-semibold text-white">Add</Text>
        </Pressable>
      </View>

      <Text className="px-4 pb-1 pt-3 text-xs text-soliflex-gray-500">{hint}</Text>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<EmptyState title={`No ${itemLabel}s yet`} description="Add one above." />}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
              <View className="flex-1 flex-row flex-wrap items-center gap-2 pr-2">
                <Text className="text-sm font-medium text-soliflex-ink">{item.name}</Text>
                {!item.active && (
                  <View className="rounded-full bg-soliflex-gray-100 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-soliflex-gray-500">Inactive</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-4">
                <Pressable onPress={() => updateM.mutate({ active: !item.active })} disabled={updateM.isPending} hitSlop={8}>
                  <Text className="text-xs font-medium text-soliflex-gray-600">{item.active ? "Deactivate" : "Activate"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditing(item);
                    setEditValue(item.name);
                  }}
                  hitSlop={8}
                >
                  <Pencil color="#55504A" size={16} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDeleting(item);
                    setDeleteTyped("");
                  }}
                  hitSlop={8}
                >
                  <Trash2 color="#DC2626" size={16} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={addOpen} title={`Add ${itemLabel}`} onClose={() => setAddOpen(false)}>
        <View className="gap-4 pb-4">
          <TextField label="Name" value={newName} onChangeText={setNewName} placeholder={placeholder} autoCapitalize="none" />
          <Button title="Add" onPress={() => createM.mutate()} disabled={!newName.trim()} loading={createM.isPending} />
        </View>
      </Modal>

      <Modal visible={!!editing} title={`Edit ${itemLabel}`} onClose={() => setEditing(null)}>
        <View className="gap-4 pb-4">
          <TextField label="Name" value={editValue} onChangeText={setEditValue} autoCapitalize="none" />
          <Text className="-mt-2 text-xs text-soliflex-gray-500">Existing tickets keep their history either way.</Text>
          <Button
            title="Save changes"
            onPress={() => updateM.mutate({ name: editValue.trim() })}
            disabled={!editValue.trim() || editValue.trim() === editing?.name}
            loading={updateM.isPending}
          />
        </View>
      </Modal>

      <Modal visible={!!deleting} title={`Delete ${itemLabel}`} onClose={() => setDeleting(null)}>
        <View className="gap-4 pb-4">
          <View className="rounded-lg bg-red-50 p-3">
            <Text className="text-sm text-red-800">
              This permanently deletes &quot;{deleting?.name}&quot;. This cannot be undone. If it&apos;s used by any ticket, deletion will be refused —
              deactivate it instead.
            </Text>
          </View>
          <Text className="text-sm text-soliflex-gray-600">
            Type <Text className="font-semibold">{deleting?.name}</Text> to confirm.
          </Text>
          <TextField value={deleteTyped} onChangeText={setDeleteTyped} autoCapitalize="none" autoFocus />
          <Pressable
            onPress={() => deleteM.mutate()}
            disabled={deleteTyped !== deleting?.name || deleteM.isPending}
            className={`flex-row items-center justify-center gap-2 rounded-lg px-4 py-3 ${
              deleteTyped === deleting?.name ? "bg-red-600" : "bg-red-300"
            }`}
          >
            {deleteM.isPending && <ActivityIndicator color="#fff" size="small" />}
            <Text className="text-sm font-semibold text-white">Delete permanently</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
