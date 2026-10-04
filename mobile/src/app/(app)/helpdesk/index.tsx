import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Plus, LayoutDashboard } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { canSeeHelpdeskDashboard } from "@/lib/roles";
import { useHelpdeskTickets } from "@/features/helpdesk/hooks";
import { TicketRow } from "@/features/helpdesk/TicketRow";
import { CreateTicketModal } from "@/features/helpdesk/CreateTicketModal";
import { AssignModal } from "@/features/helpdesk/AssignModal";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { HELPDESK_CATEGORY_LABELS, HELPDESK_STATUS_LABELS } from "@/features/helpdesk/badges";
import type { HelpdeskCategory, HelpdeskFilter, HelpdeskStatus, HelpdeskTicket } from "@/lib/types";

const STATUS_OPTIONS = (Object.keys(HELPDESK_STATUS_LABELS) as HelpdeskStatus[]).map((value) => ({
  value,
  label: HELPDESK_STATUS_LABELS[value],
}));
const CATEGORY_OPTIONS = (Object.keys(HELPDESK_CATEGORY_LABELS) as HelpdeskCategory[]).map((value) => ({
  value,
  label: HELPDESK_CATEGORY_LABELS[value],
}));

export default function HelpdeskListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLead = user?.role === "IT_TEAM_LEAD" || user?.role === "ADMIN";
  const isEngineer = user?.role === "IT_SUPPORT_ENGINEER";
  const title = isLead ? "Helpdesk Queue" : isEngineer ? "My Queue" : "My Requests";

  const [filter, setFilter] = useState<HelpdeskFilter>({});
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTicket, setAssignTicket] = useState<HelpdeskTicket | null>(null);

  const effectiveFilter = useMemo(() => ({ ...filter, search: search || undefined }), [filter, search]);
  const { data: tickets, isLoading } = useHelpdeskTickets(effectiveFilter);

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white py-1 pl-1 pr-4">
        <View className="flex-row items-center">
          <DrawerToggleButton tintColor="#23272B" />
          <Text className="text-lg font-bold text-soliflex-ink">{title}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          {canSeeHelpdeskDashboard(user?.role) && (
            <Pressable onPress={() => router.push("/helpdesk/dashboard")} hitSlop={8}>
              <LayoutDashboard color="#23272B" size={22} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setCreateOpen(true)}
            className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2"
          >
            <Plus color="#fff" size={16} />
            <Text className="text-xs font-semibold text-white">Raise ticket</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-3 border-b border-soliflex-gray-100 bg-white px-4 py-3">
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
              placeholder="All categories"
              value={filter.category}
              options={CATEGORY_OPTIONS}
              onChange={(category) => setFilter((f) => ({ ...f, category }))}
            />
          </View>
        </View>
        <DateRangeFilter value={filter} onChange={(range) => setFilter((f) => ({ ...f, ...range }))} />
        {isLead && (
          <Pressable
            onPress={() => setFilter((f) => ({ ...f, missingDeadline: !f.missingDeadline }))}
            className={`self-start rounded-full border px-3 py-1.5 ${
              filter.missingDeadline ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200"
            }`}
          >
            <Text className={`text-xs font-medium ${filter.missingDeadline ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
              Missing deadline only
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={tickets ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TicketRow
              ticket={item}
              user={user}
              showRaisedBy={isLead}
              onPress={() => router.push(`/helpdesk/${item.id}`)}
              onAssign={() => setAssignTicket(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No helpdesk tickets found" description="Try adjusting the filters or raise a new request." />
          }
        />
      )}

      <CreateTicketModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      {assignTicket && <AssignModal visible ticket={assignTicket} onClose={() => setAssignTicket(null)} />}
    </SafeAreaView>
  );
}
