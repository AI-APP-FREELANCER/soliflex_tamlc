import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useTicketMutations, useTicket } from "@/features/tickets/hooks";
import { AssignModal } from "@/features/tickets/AssignModal";
import { CloseModal } from "@/features/tickets/CloseModal";
import { HoldModal } from "@/features/tickets/HoldModal";
import { AttachmentSection } from "@/features/tickets/AttachmentSection";
import { CostSection } from "@/features/tickets/CostSection";
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from "@/features/tickets/badges";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/features/helpdesk/badges";
import { canAssign, canDirectClose, canEditAssignment, canHold, canReopen, canResume, canStartProgress } from "@/features/tickets/permissions";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { formatIST } from "@/lib/formatIST";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 py-2 pr-2">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className="mt-0.5 text-sm font-medium text-soliflex-ink">{value}</Text>
    </View>
  );
}

/** The IT ticket workflow: OPEN -> ASSIGNED -> IN_PROGRESS -> CLOSED, with reopen and a simple hold/resume. */
export default function ITTicketDetailScreen({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: ticket } = useTicket(id);
  const mutations = useTicketMutations(id);

  const [assignOpen, setAssignOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [comment, setComment] = useState("");

  if (!ticket) return null;
  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const isTechnician = user?.role === "IT_TEAM";
  const statusColor = TICKET_STATUS_COLORS[ticket.status];

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: ticket.ticketNumber }} />
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label={TICKET_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
            {ticket.priority && (
              <Badge label={PRIORITY_LABELS[ticket.priority]} bg={PRIORITY_COLORS[ticket.priority].bg} text={PRIORITY_COLORS[ticket.priority].text} />
            )}
            {ticket.onHold && <Badge label="On hold" bg="#FFFBEB" text="#B45309" />}
            {ticket.slaBreached && <Badge label="SLA breached" bg="#FEF2F2" text="#B91C1C" />}
          </View>
          <Text className="mt-2 text-base font-bold text-soliflex-ink">{ticket.displayTitle}</Text>
          <Text className="mt-2 text-sm text-soliflex-gray-700">{ticket.description}</Text>

          {ticket.onHold && ticket.onHoldDetail && (
            <View className="mt-3 rounded-lg bg-amber-50 p-3">
              <Text className="text-xs text-amber-800">{ticket.onHoldDetail}</Text>
            </View>
          )}
        </View>

        <View className="mt-3 flex-row flex-wrap rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <InfoRow label="Category" value={TICKET_CATEGORY_LABELS[ticket.category]} />
          <InfoRow label="Reported by" value={ticket.reportedBy?.name ?? "—"} />
          <InfoRow label="Assigned to" value={ticket.assignedTo?.name ?? "Unassigned"} />
          <InfoRow label="Manager" value={ticket.manager?.name ?? "—"} />
          {ticket.effortEstimateHours != null && <InfoRow label="Effort estimate" value={`${ticket.effortEstimateHours}h`} />}
          {ticket.targetCompletionDate && <InfoRow label="Target completion" value={formatIST(ticket.targetCompletionDate, "dd MMM yyyy")} />}
          <InfoRow label="Raised on" value={formatIST(ticket.createdAt, "dd MMM yyyy, HH:mm")} />
        </View>

        <View className="mt-3 gap-2 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-1 text-sm font-semibold text-soliflex-ink">Actions</Text>

          {canAssign(ticket, user) && <Button title="Assign technician" onPress={() => setAssignOpen(true)} />}
          {canEditAssignment(ticket, user) && <Button title="Edit assignment" variant="outline" onPress={() => setAssignOpen(true)} />}

          {canStartProgress(ticket, user) && (
            <Button title="Start work" onPress={() => mutations.startProgress.mutate(ticket.id)} loading={mutations.startProgress.isPending} />
          )}

          {canDirectClose(ticket, user) && <Button title="Resolve & close" onPress={() => setCloseOpen(true)} />}

          {canHold(ticket, user) && <Button title="Put on hold" variant="secondary" onPress={() => setHoldOpen(true)} />}
          {canResume(ticket, user) && (
            <Button title="Resume ticket" variant="secondary" onPress={() => mutations.resume.mutate(ticket.id)} loading={mutations.resume.isPending} />
          )}

          {canReopen(ticket, user) && (
            <View className="gap-2">
              <TextField placeholder="Why does this need to be reopened?" value={reopenReason} onChangeText={setReopenReason} />
              <Button
                title="Reopen"
                variant="outline"
                disabled={!reopenReason.trim()}
                loading={mutations.reopen.isPending}
                onPress={() => mutations.reopen.mutate({ id: ticket.id, reason: reopenReason.trim() }, { onSuccess: () => setReopenReason("") })}
              />
            </View>
          )}
        </View>

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <AttachmentSection ticket={ticket} />
        </View>

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <CostSection ticket={ticket} canEdit={isManager || isTechnician} />
        </View>

        {!!ticket.statusHistory?.length && (
          <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
            <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Activity</Text>
            {ticket.statusHistory.map((h, idx) => (
              <View key={h.id} className={`py-2 ${idx < ticket.statusHistory!.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}>
                <Text className="text-sm text-soliflex-ink">
                  {TICKET_STATUS_LABELS[h.toStatus]} · {h.changedBy?.name ?? "—"}
                </Text>
                <Text className="text-xs text-soliflex-gray-500">{formatIST(h.createdAt)}</Text>
                {h.comment && <Text className="mt-1 text-xs text-soliflex-gray-600">{h.comment}</Text>}
              </View>
            ))}
          </View>
        )}

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Comments</Text>
          {ticket.comments?.length ? (
            ticket.comments.map((c, idx) => (
              <View key={c.id} className={`py-2 ${idx < ticket.comments!.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}>
                <Text className="text-xs font-semibold text-soliflex-ink">{c.author?.name ?? "—"}</Text>
                <Text className="text-xs text-soliflex-gray-400">{formatIST(c.createdAt)}</Text>
                <Text className="mt-1 text-sm text-soliflex-gray-700">{c.body}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-soliflex-gray-500">No comments yet.</Text>
          )}
          <View className="mt-3 gap-2">
            <TextField placeholder="Add a comment" value={comment} onChangeText={setComment} />
            <Button
              title="Send"
              variant="secondary"
              disabled={!comment.trim()}
              loading={mutations.addComment.isPending}
              onPress={() => mutations.addComment.mutate({ id: ticket.id, body: comment.trim() }, { onSuccess: () => setComment("") })}
            />
          </View>
        </View>
      </ScrollView>

      <AssignModal visible={assignOpen} ticket={ticket} onClose={() => setAssignOpen(false)} />
      <CloseModal visible={closeOpen} ticket={ticket} onClose={() => setCloseOpen(false)} />
      <HoldModal visible={holdOpen} ticket={ticket} onClose={() => setHoldOpen(false)} />
    </SafeAreaView>
  );
}
