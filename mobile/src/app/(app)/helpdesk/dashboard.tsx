import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { canSeeHelpdeskDashboard } from "@/lib/roles";
import { useHelpdeskDashboardStats } from "@/features/helpdesk/hooks";
import { HELPDESK_STATUS_LABELS } from "@/features/helpdesk/badges";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { SimpleBarChart } from "@/components/SimpleBarChart";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import type { DateRangeValue, HelpdeskStatus } from "@/lib/types";

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "#B91C1C" : tone === "warn" ? "#B45309" : "#23272B";
  return (
    <View className="flex-1 rounded-xl border border-soliflex-gray-100 bg-white p-3">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

export default function HelpdeskDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [range, setRange] = useState<DateRangeValue>({});
  const { data: stats, isLoading } = useHelpdeskDashboardStats(range);

  if (!canSeeHelpdeskDashboard(user?.role)) {
    return (
      <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
        <Stack.Screen options={{ title: "Dashboard" }} />
        <EmptyState title="Not available" description="This dashboard is only available to IT Team Leads and Admins." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: "Helpdesk Dashboard" }} />
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <DateRangeFilter value={range} onChange={setRange} />

        {isLoading || !stats ? (
          <Spinner />
        ) : (
          <>
            <View className="mt-4 flex-row gap-3">
              <StatCard label="Total tickets" value={stats.total} />
              <StatCard label="Overdue" value={stats.overdueCount} tone="danger" />
            </View>
            <View className="mt-3 flex-row gap-3">
              <StatCard label="Missing deadline" value={stats.missingDeadlineCount} tone="warn" />
              <StatCard label="Engineers tracked" value={stats.perEngineerWorkload.length} />
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-3 text-sm font-semibold text-soliflex-ink">By status</Text>
              <SimpleBarChart
                data={stats.byStatus.map((s) => ({
                  label: HELPDESK_STATUS_LABELS[s.status as HelpdeskStatus],
                  value: s.count,
                }))}
              />
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Engineer workload</Text>
              {stats.perEngineerWorkload.length === 0 ? (
                <Text className="text-sm text-soliflex-gray-500">No engineers to show.</Text>
              ) : (
                stats.perEngineerWorkload.map((e) => (
                  <View key={e.engineerId} className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-2">
                    <Text className="flex-1 text-sm text-soliflex-ink">{e.name}</Text>
                    <Text className="w-16 text-center text-xs text-soliflex-gray-600">{e.open} open</Text>
                    <Text className="w-20 text-center text-xs text-soliflex-gray-600">{e.inProgress} active</Text>
                    <Text className={`w-20 text-center text-xs ${e.overdue > 0 ? "font-bold text-red-600" : "text-soliflex-gray-600"}`}>
                      {e.overdue} overdue
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
