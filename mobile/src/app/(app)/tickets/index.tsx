import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Plus } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { useTickets } from "@/features/tickets/hooks";
import { TicketRow } from "@/features/tickets/TicketRow";
import { CreateTicketModal } from "@/features/tickets/CreateTicketModal";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TICKET_STATUS_LABELS } from "@/features/tickets/badges";
import { PRIORITY_LABELS } from "@/features/helpdesk/badges";
import type { Priority, TicketFilter, TicketStatus, Workstream } from "@/lib/types";

const STATUS_OPTIONS = (Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((value) => ({
  value,
  label: TICKET_STATUS_LABELS[value],
}));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({ value, label: PRIORITY_LABELS[value] }));

function defaultWorkstream(role: string | undefined): Workstream {
  return role === "IT_TEAM" ? "IT" : "MAINTENANCE";
}

export default function TicketsListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canToggleWorkstream = user?.role === "MANAGER" || user?.role === "ADMIN";

  const [workstream, setWorkstream] = useState<Workstream>(defaultWorkstream(user?.role));
  const [filter, setFilter] = useState<TicketFilter>({});
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const effectiveFilter = useMemo(
    () => ({ ...filter, workstream, search: search || undefined }),
    [filter, workstream, search]
  );
  const { data: tickets, isLoading } = useTickets(effectiveFilter);

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white py-1 pl-1 pr-4">
        <View className="flex-row items-center">
          <DrawerToggleButton tintColor="#23272B" />
          <Text className="text-lg font-bold text-soliflex-ink">Maintenance / IT Tickets</Text>
        </View>
        <Pressable
          onPress={() => setCreateOpen(true)}
          className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2"
        >
          <Plus color="#fff" size={16} />
          <Text className="text-xs font-semibold text-white">Raise ticket</Text>
        </Pressable>
      </View>

      <View className="gap-3 border-b border-soliflex-gray-100 bg-white px-4 py-3">
        {canToggleWorkstream && (
          <View className="flex-row gap-2">
            {(["MAINTENANCE", "IT"] as Workstream[]).map((w) => {
              const active = workstream === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setWorkstream(w)}
                  className={`flex-1 items-center rounded-lg border py-2 ${
                    active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${active ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
                    {w === "MAINTENANCE" ? "Maintenance" : "IT"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <TextField placeholder="Search title or ticket #" value={search} onChangeText={setSearch} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <SelectField
              placeholder="All statuses"
              value={filter.status}
              options={STATUS_OPTIONS}
              onChange={(status) => setFilter((f) => ({ ...f, status }))}
            />
          </View>
          <View className="flex-1">
            <SelectField
              placeholder="All priorities"
              value={filter.priority}
              options={PRIORITY_OPTIONS}
              onChange={(priority) => setFilter((f) => ({ ...f, priority }))}
            />
          </View>
        </View>
        <DateRangeFilter value={filter} onChange={(range) => setFilter((f) => ({ ...f, ...range }))} />
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={tickets ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TicketRow ticket={item} onPress={() => router.push(`/tickets/${item.id}`)} />}
          ListEmptyComponent={
            <EmptyState title="No tickets found" description="Try adjusting the filters or raise a new ticket." />
          }
        />
      )}

      <CreateTicketModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => router.push(`/tickets/${id}`)}
      />
    </SafeAreaView>
  );
}
