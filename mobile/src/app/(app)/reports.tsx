import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/store/auth.store";
import { fetchExpiringAssets, fetchOverdueTickets, fetchReportsDashboard, fetchReportsExportBytes } from "@/api/reports";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { SimpleBarChart } from "@/components/SimpleBarChart";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";
import { apiErrorMessage } from "@/lib/api-client";
import { formatIST } from "@/lib/formatIST";
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from "@/features/tickets/badges";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/features/helpdesk/badges";
import type { DateRangeValue, TicketStatus, Workstream } from "@/lib/types";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "#B91C1C" : tone === "warn" ? "#B45309" : "#23272B";
  return (
    <View className="flex-1 rounded-xl border border-soliflex-gray-100 bg-white p-3">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className="mt-1 text-xl font-bold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

function defaultWorkstream(role: string | undefined): Workstream {
  return role === "IT_TEAM" ? "IT" : "MAINTENANCE";
}

export default function ReportsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canToggleWorkstream = user?.role === "MANAGER" || user?.role === "ADMIN";
  const [workstream, setWorkstream] = useState<Workstream>(defaultWorkstream(user?.role));
  const [range, setRange] = useState<DateRangeValue>({});
  const [exporting, setExporting] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reports-dashboard", workstream, range],
    queryFn: () => fetchReportsDashboard(workstream, range),
  });
  const { data: overdue } = useQuery({
    queryKey: ["reports-overdue", workstream, range],
    queryFn: () => fetchOverdueTickets(workstream, range),
  });
  const { data: expiring } = useQuery({ queryKey: ["reports-expiring"], queryFn: () => fetchExpiringAssets(60) });

  async function handleExport() {
    setExporting(true);
    try {
      const bytes = await fetchReportsExportBytes(workstream);
      const file = new File(Paths.document, `soliflex-tickets-report-${Date.now()}.xlsx`);
      file.create({ overwrite: true });
      file.write(new Uint8Array(bytes));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Share tickets report",
        });
      } else {
        Alert.alert("Saved", `Report saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert("Export failed", apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 bg-white px-4 py-3">
        <Text className="text-lg font-bold text-soliflex-ink">{workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Reports</Text>
        <Pressable onPress={handleExport} disabled={exporting} className="flex-row items-center gap-1 rounded-lg bg-soliflex-orange-500 px-3 py-2">
          <Download color="#fff" size={16} />
          <Text className="text-xs font-semibold text-white">{exporting ? "Exporting…" : "Export"}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {canToggleWorkstream && (
          <View className="mb-3 flex-row gap-2">
            {(["MAINTENANCE", "IT"] as Workstream[]).map((w) => {
              const active = workstream === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setWorkstream(w)}
                  className={`flex-1 items-center rounded-lg border py-2 ${active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200 bg-white"}`}
                >
                  <Text className={`text-xs font-semibold ${active ? "text-soliflex-orange-600" : "text-soliflex-gray-600"}`}>
                    {w === "MAINTENANCE" ? "Maintenance" : "IT"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <DateRangeFilter value={range} onChange={setRange} />

        {isLoading || !stats ? (
          <Spinner />
        ) : (
          <>
            <View className="mt-4 flex-row gap-3">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Open" value={stats.open} />
              <StatCard label="Closed" value={stats.closed} />
            </View>
            <View className="mt-3 flex-row gap-3">
              <StatCard label="On hold" value={stats.onHold} tone="warn" />
              <StatCard label="SLA breached" value={stats.slaBreached} tone="danger" />
              <StatCard label="Avg resolution" value={`${stats.avgResolutionHours.toFixed(1)}h`} />
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-3 text-sm font-semibold text-soliflex-ink">Tickets by status</Text>
              <SimpleBarChart data={stats.byStatus.map((s) => ({ label: TICKET_STATUS_LABELS[s.status as TicketStatus], value: s.count }))} />
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Tickets by priority</Text>
              {stats.byPriority.map((p) => (
                <View key={p.priority} className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-2">
                  <Badge
                    label={PRIORITY_LABELS[p.priority]}
                    bg={PRIORITY_COLORS[p.priority].bg}
                    text={PRIORITY_COLORS[p.priority].text}
                  />
                  <Text className="text-sm font-medium text-soliflex-ink">{p.count}</Text>
                </View>
              ))}
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Past target completion</Text>
              {overdue?.length ? (
                overdue.map((t) => {
                  const colors = TICKET_STATUS_COLORS[t.status];
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push(`/tickets/${t.id}`)}
                      className="border-b border-soliflex-gray-50 py-2"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="flex-1 text-sm font-medium text-soliflex-ink" numberOfLines={1}>
                          {t.ticketNumber} — {t.title}
                        </Text>
                        <Badge label={TICKET_STATUS_LABELS[t.status]} bg={colors.bg} text={colors.text} />
                      </View>
                      <Text className="text-xs text-red-600">
                        Overdue by {formatDistanceToNow(new Date(t.targetCompletionDate))} · {t.assignedTo?.name ?? "Unassigned"}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text className="text-sm text-soliflex-gray-500">Nothing overdue.</Text>
              )}
            </View>

            <View className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-4">
              <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Warranty / license expiring within 60 days</Text>
              {(() => {
                const list = workstream === "MAINTENANCE" ? expiring?.maintenance ?? [] : expiring?.it ?? [];
                if (!list.length) return <Text className="text-sm text-soliflex-gray-500">Nothing expiring soon.</Text>;
                return list.map((a) => {
                  const expiryDate = a.warrantyEndDate ?? ("licenseExpiryDate" in a ? a.licenseExpiryDate : null);
                  return (
                    <View key={a.id} className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-2">
                      <Text className="flex-1 text-sm text-soliflex-ink" numberOfLines={1}>
                        {a.itemCode} — {a.name}
                      </Text>
                      <Text className="text-xs text-soliflex-gray-600">{expiryDate ? formatIST(expiryDate, "dd MMM yyyy") : "—"}</Text>
                    </View>
                  );
                });
              })()}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
