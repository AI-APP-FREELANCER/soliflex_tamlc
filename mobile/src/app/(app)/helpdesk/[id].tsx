import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useHelpdeskMutations, useHelpdeskTicket } from "@/features/helpdesk/hooks";
import { AssignModal } from "@/features/helpdesk/AssignModal";
import {
  HELPDESK_CATEGORY_LABELS,
  HELPDESK_STATUS_COLORS,
  HELPDESK_STATUS_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from "@/features/helpdesk/badges";
import {
  canAssignTicket,
  canClose,
  canHoldOrResume,
  canReopen,
  canResolve,
  canStartProgress,
} from "@/features/helpdesk/permissions";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Spinner } from "@/components/Spinner";
import { formatIST } from "@/lib/formatIST";

function InfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="w-1/2 py-2 pr-2">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className={`mt-0.5 text-sm font-medium ${danger ? "text-red-600" : "text-soliflex-ink"}`}>{value}</Text>
    </View>
  );
}

export default function HelpdeskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, isLoading } = useHelpdeskTicket(id);
  const mutations = useHelpdeskMutations(id);

  const [assignOpen, setAssignOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [comment, setComment] = useState("");

  if (isLoading || !ticket) {
    return (
      <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
        <Stack.Screen options={{ title: "Ticket" }} />
        <Spinner />
      </SafeAreaView>
    );
  }

  const statusColor = HELPDESK_STATUS_COLORS[ticket.status];

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: ticket.ticketNumber }} />
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header card */}
        <View className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label={HELPDESK_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
            {ticket.priority && (
              <Badge label={PRIORITY_LABELS[ticket.priority]} bg={PRIORITY_COLORS[ticket.priority].bg} text={PRIORITY_COLORS[ticket.priority].text} />
            )}
            {ticket.onHold && <Badge label="On hold" bg="#FFFBEB" text="#B45309" />}
            {ticket.deadlineBreached && <Badge label="Deadline breached" bg="#FEF2F2" text="#B91C1C" />}
          </View>
          <Text className="mt-2 text-base font-bold text-soliflex-ink">{ticket.title}</Text>
          <Text className="mt-2 text-sm text-soliflex-gray-700">{ticket.description}</Text>
        </View>

        {/* Info grid */}
        <View className="mt-3 flex-row flex-wrap rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <InfoRow label="Category" value={HELPDESK_CATEGORY_LABELS[ticket.category]} />
          <InfoRow label="Raised by" value={ticket.raisedBy?.name ?? "—"} />
          <InfoRow label="Assigned to" value={ticket.assignedTo?.name ?? "Unassigned"} />
          <InfoRow label="Team lead" value={ticket.teamLead?.name ?? "—"} />
          <InfoRow
            label="Deadline"
            value={ticket.deadline ? formatIST(ticket.deadline, "dd MMM yyyy, HH:mm") : "Not set"}
            danger={ticket.deadlineBreached}
          />
          <InfoRow label="Raised on" value={formatIST(ticket.createdAt, "dd MMM yyyy, HH:mm")} />
        </View>

        {/* Actions */}
        <View className="mt-3 gap-2 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-1 text-sm font-semibold text-soliflex-ink">Actions</Text>

          {canAssignTicket(ticket, user) && (
            <Button
              title={ticket.assignedToId ? "Reassign" : "Assign"}
              onPress={() => setAssignOpen(true)}
            />
          )}

          {canStartProgress(ticket, user) && (
            <Button
              title="Start progress"
              onPress={() => mutations.startProgress.mutate(ticket.id)}
              loading={mutations.startProgress.isPending}
            />
          )}

          {canHoldOrResume(ticket, user) &&
            (ticket.onHold ? (
              <Button
                title="Resume"
                variant="secondary"
                onPress={() => mutations.resume.mutate(ticket.id)}
                loading={mutations.resume.isPending}
              />
            ) : (
              <View className="gap-2">
                <TextField
                  placeholder="Reason for putting this on hold"
                  value={holdReason}
                  onChangeText={setHoldReason}
                />
                <Button
                  title="Put on hold"
                  variant="secondary"
                  disabled={!holdReason.trim()}
                  loading={mutations.hold.isPending}
                  onPress={() =>
                    mutations.hold.mutate(
                      { id: ticket.id, detail: holdReason.trim() },
                      { onSuccess: () => setHoldReason("") }
                    )
                  }
                />
              </View>
            ))}

          {canResolve(ticket, user) && (
            <Button
              title="Mark resolved"
              onPress={() => mutations.resolve.mutate({ id: ticket.id })}
              loading={mutations.resolve.isPending}
            />
          )}

          {canClose(ticket, user) && (
            <Button
              title="Close ticket"
              onPress={() => mutations.close.mutate(ticket.id)}
              loading={mutations.close.isPending}
            />
          )}

          {canReopen(ticket, user) && (
            <View className="gap-2">
              <TextField
                placeholder="Why does this need to be reopened?"
                value={reopenReason}
                onChangeText={setReopenReason}
              />
              <Button
                title="Reopen"
                variant="outline"
                disabled={!reopenReason.trim()}
                loading={mutations.reopen.isPending}
                onPress={() =>
                  mutations.reopen.mutate(
                    { id: ticket.id, reason: reopenReason.trim() },
                    { onSuccess: () => setReopenReason("") }
                  )
                }
              />
            </View>
          )}
        </View>

        {/* Status history */}
        {!!ticket.statusHistory?.length && (
          <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
            <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Status history</Text>
            {ticket.statusHistory.map((h, idx) => (
              <View
                key={h.id}
                className={`py-2 ${idx < ticket.statusHistory!.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}
              >
                <Text className="text-sm text-soliflex-ink">
                  {HELPDESK_STATUS_LABELS[h.toStatus]} · {h.changedBy?.name ?? "—"}
                </Text>
                <Text className="text-xs text-soliflex-gray-500">{formatIST(h.createdAt)}</Text>
                {h.comment && <Text className="mt-1 text-xs text-soliflex-gray-600">{h.comment}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Comments */}
        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Comments</Text>
          {ticket.comments?.length ? (
            ticket.comments.map((c, idx) => (
              <View
                key={c.id}
                className={`py-2 ${idx < ticket.comments!.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}
              >
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
              onPress={() =>
                mutations.addComment.mutate(
                  { id: ticket.id, body: comment.trim() },
                  { onSuccess: () => setComment("") }
                )
              }
            />
          </View>
        </View>
      </ScrollView>

      <AssignModal visible={assignOpen} ticket={ticket} onClose={() => setAssignOpen(false)} />
    </SafeAreaView>
  );
}
