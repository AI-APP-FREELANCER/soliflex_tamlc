import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { useTicketMutations, useTicket } from "@/features/tickets/hooks";
import { AttachmentSection } from "@/features/tickets/AttachmentSection";
import { CostSection } from "@/features/tickets/CostSection";
import {
  CHECKLIST_ANSWER_LABELS,
  DELAY_REASON_LABELS,
  PROBLEM_TYPE_LABELS,
  QUALITY_RATING_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_STATUS_LABELS,
} from "@/features/tickets/badges";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/features/helpdesk/badges";
import { canAcknowledge, canMaintHold, canMaintResume, canMarkVerificationNeeded, canStartProgress, canVerifyOrReject } from "@/features/tickets/permissions";
import { fetchUsers } from "@/api/users";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { Modal } from "@/components/Modal";
import { formatIST } from "@/lib/formatIST";
import type { ChecklistAnswer, DelayReason, QualityRating } from "@/lib/types";

const CERTIFY_STATEMENT = "I certify that the asset/machine has been repaired and is now in safe, workable condition.";
const DELAY_REASONS: DelayReason[] = ["TECHNICIAN_NOT_AVAILABLE", "WAITING_FOR_SPARES", "WAITING_FOR_EXTERNAL_SERVICE", "NEED_TECHNICAL_SUPPORT", "OTHERS"];
const QUALITY_RATINGS: QualityRating[] = ["EXCELLENT", "GOOD", "FAIR", "POOR"];
const CHECKLIST_ANSWERS: ChecklistAnswer[] = ["YES", "NO", "NA"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 py-2 pr-2">
      <Text className="text-xs text-soliflex-gray-500">{label}</Text>
      <Text className="mt-0.5 text-sm font-medium text-soliflex-ink">{value}</Text>
    </View>
  );
}

function Checkbox({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-start gap-2">
      <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${checked ? "border-soliflex-orange-500 bg-soliflex-orange-500" : "border-soliflex-gray-300"}`}>
        {checked && <Check color="#fff" size={14} />}
      </View>
      <Text className="flex-1 text-sm text-soliflex-ink">{children}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- modals ---

function AcknowledgeModal({ ticketId, visible, onClose }: { ticketId: string; visible: boolean; onClose: () => void }) {
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const mechanics = users.filter((u) => u.active && u.role === "MECHANIC");
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const { acknowledge } = useTicketMutations(ticketId);

  return (
    <Modal visible={visible} title="Acknowledge & assign" onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField label="Assign to" value={assigneeId} options={mechanics.map((u) => ({ value: u.id, label: u.name }))} onChange={setAssigneeId} />
        <Button
          title="Acknowledge"
          onPress={() => acknowledge.mutate({ id: ticketId, assigneeId }, { onSuccess: onClose })}
          disabled={!assigneeId}
          loading={acknowledge.isPending}
        />
      </View>
    </Modal>
  );
}

function MaintHoldModal({ ticketId, visible, onClose }: { ticketId: string; visible: boolean; onClose: () => void }) {
  const [useReason, setUseReason] = useState(false);
  const [delayReason, setDelayReason] = useState<DelayReason>("WAITING_FOR_SPARES");
  const [delayNotes, setDelayNotes] = useState("");
  const { maintHold } = useTicketMutations(ticketId);
  const notesOk = !useReason || (delayNotes.trim().length >= 10 && delayNotes.trim().length <= 300);

  return (
    <Modal visible={visible} title="Put on hold" onClose={onClose}>
      <View className="gap-4 pb-4">
        <Checkbox checked={useReason} onPress={() => setUseReason((v) => !v)}>
          Record a reason for the delay (optional)
        </Checkbox>
        {useReason && (
          <>
            <SelectField label="Reason for delay" value={delayReason} options={DELAY_REASONS.map((r) => ({ value: r, label: DELAY_REASON_LABELS[r] }))} onChange={setDelayReason} />
            <TextField
              label="Notes"
              placeholder="10-300 characters"
              value={delayNotes}
              onChangeText={setDelayNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 72 }}
            />
          </>
        )}
        <Button
          title="Put on hold"
          onPress={() => maintHold.mutate({ id: ticketId, data: useReason ? { delayReason, delayNotes: delayNotes.trim() } : {} }, { onSuccess: onClose })}
          disabled={!notesOk}
          loading={maintHold.isPending}
        />
      </View>
    </Modal>
  );
}

function ChecklistModal({ ticketId, visible, onClose }: { ticketId: string; visible: boolean; onClose: () => void }) {
  const [toolsReclaimed, setToolsReclaimed] = useState<ChecklistAnswer | undefined>();
  const [machineCleaned, setMachineCleaned] = useState<ChecklistAnswer | undefined>();
  const [cableRouting, setCableRouting] = useState<ChecklistAnswer | undefined>();
  const { markVerificationNeeded } = useTicketMutations(ticketId);
  const complete = !!toolsReclaimed && !!machineCleaned && !!cableRouting;

  return (
    <Modal visible={visible} title="Post-maintenance checklist (5S)" onClose={onClose}>
      <View className="gap-4 pb-4">
        <Text className="text-xs text-soliflex-gray-500">Confirm all three before sending this to Production for verification.</Text>
        <SelectField
          label="All tools reclaimed (5S)"
          value={toolsReclaimed}
          options={CHECKLIST_ANSWERS.map((a) => ({ value: a, label: CHECKLIST_ANSWER_LABELS[a] }))}
          onChange={setToolsReclaimed}
        />
        <SelectField
          label="Machine cleaned against dust / oil (5S)"
          value={machineCleaned}
          options={CHECKLIST_ANSWERS.map((a) => ({ value: a, label: CHECKLIST_ANSWER_LABELS[a] }))}
          onChange={setMachineCleaned}
        />
        <SelectField
          label="Proper cable routing (5S)"
          value={cableRouting}
          options={CHECKLIST_ANSWERS.map((a) => ({ value: a, label: CHECKLIST_ANSWER_LABELS[a] }))}
          onChange={setCableRouting}
        />
        <Button
          title="Send for verification"
          onPress={() => complete && markVerificationNeeded.mutate({ id: ticketId, data: { toolsReclaimed, machineCleaned, cableRouting } }, { onSuccess: onClose })}
          disabled={!complete}
          loading={markVerificationNeeded.isPending}
        />
      </View>
    </Modal>
  );
}

function VerifyModal({ ticketId, visible, onClose }: { ticketId: string; visible: boolean; onClose: () => void }) {
  const [qualityRating, setQualityRating] = useState<QualityRating | undefined>();
  const [qualityFeedback, setQualityFeedback] = useState("");
  const [certify, setCertify] = useState(false);
  const { verifyAndClose } = useTicketMutations(ticketId);

  return (
    <Modal visible={visible} title="Verify & close" onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField
          label="Quality of the maintenance resolution"
          value={qualityRating}
          options={QUALITY_RATINGS.map((r) => ({ value: r, label: QUALITY_RATING_LABELS[r] }))}
          onChange={setQualityRating}
        />
        <TextField label="Feedback (optional)" value={qualityFeedback} onChangeText={setQualityFeedback} multiline numberOfLines={2} textAlignVertical="top" style={{ minHeight: 56 }} />
        <Checkbox checked={certify} onPress={() => setCertify((v) => !v)}>
          {CERTIFY_STATEMENT}
        </Checkbox>
        <Button
          title="Verify & close"
          onPress={() =>
            qualityRating &&
            certify &&
            verifyAndClose.mutate({ id: ticketId, data: { qualityRating, qualityFeedback: qualityFeedback.trim() || undefined, certify: true } }, { onSuccess: onClose })
          }
          disabled={!qualityRating || !certify}
          loading={verifyAndClose.isPending}
        />
      </View>
    </Modal>
  );
}

function RejectModal({ ticketId, visible, onClose }: { ticketId: string; visible: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const { rejectVerification } = useTicketMutations(ticketId);

  return (
    <Modal visible={visible} title="Reject the fix" onClose={onClose}>
      <View className="gap-4 pb-4">
        <Text className="text-sm text-soliflex-gray-600">This sends the ticket back to the maintenance team to work on again.</Text>
        <TextField
          placeholder="What still needs fixing?"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
        <Button
          title="Reject & send back"
          variant="outline"
          onPress={() => reason.trim() && rejectVerification.mutate({ id: ticketId, data: { reason: reason.trim() } }, { onSuccess: onClose })}
          disabled={!reason.trim()}
          loading={rejectVerification.isPending}
        />
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------- screen ---

export default function MaintenanceTicketDetailScreen({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: ticket } = useTicket(id);
  const mutations = useTicketMutations(id);

  const [showAcknowledge, setShowAcknowledge] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  if (!ticket) return null;
  const isMechanic = user?.role === "MECHANIC";
  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const isTechnician = user?.role === "MECHANIC";
  const statusColor = TICKET_STATUS_COLORS[ticket.status];
  const hasChecklist = ticket.checklistToolsReclaimed || ticket.checklistMachineCleaned || ticket.checklistCableRouting;

  return (
    <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
      <Stack.Screen options={{ title: ticket.ticketNumber }} />
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Problem (ticket info) - shown first, per customer's requested flow */}
        <View className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label={TICKET_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
            {ticket.priority && <Badge label={PRIORITY_LABELS[ticket.priority]} bg={PRIORITY_COLORS[ticket.priority].bg} text={PRIORITY_COLORS[ticket.priority].text} />}
            {ticket.machineStatus && (
              <Badge
                label={ticket.machineStatus === "RUNNING" ? "Machine Running" : "Machine Stopped"}
                bg={ticket.machineStatus === "RUNNING" ? "#F0FDF4" : "#FEF2F2"}
                text={ticket.machineStatus === "RUNNING" ? "#15803D" : "#B91C1C"}
              />
            )}
          </View>
          <Text className="mt-2 text-base font-bold text-soliflex-ink">{ticket.displayTitle}</Text>
          <View className="mt-1 flex-row flex-wrap gap-x-3">
            {ticket.machine && (
              <Text className="text-xs text-soliflex-gray-500">
                Machine: {ticket.machine.name} ({ticket.machine.itemCode})
              </Text>
            )}
            {ticket.plant && <Text className="text-xs text-soliflex-gray-500">Plant: {ticket.plant.name}</Text>}
            {ticket.department && <Text className="text-xs text-soliflex-gray-500">Dept: {ticket.department.name}</Text>}
            {ticket.problemType && <Text className="text-xs text-soliflex-gray-500">Problem: {PROBLEM_TYPE_LABELS[ticket.problemType]}</Text>}
          </View>
          <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-soliflex-gray-400">Problem Description</Text>
          <Text className="mt-1 text-sm text-soliflex-gray-700">{ticket.description}</Text>

          {ticket.status === "ON_HOLD" && (
            <View className="mt-3 rounded-lg bg-amber-50 p-3">
              <Text className="text-xs text-amber-800">
                On hold{ticket.delayReason ? ` — ${DELAY_REASON_LABELS[ticket.delayReason]}` : ""}
              </Text>
              {ticket.delayNotes && <Text className="mt-1 text-xs text-amber-800">{ticket.delayNotes}</Text>}
            </View>
          )}

          {!!hasChecklist && (
            <View className="mt-3 rounded-lg border border-soliflex-gray-100 bg-soliflex-gray-50 p-3">
              <Text className="mb-1 text-sm font-semibold text-soliflex-ink">Post-maintenance checklist (5S)</Text>
              <Text className="text-xs text-soliflex-gray-600">Tools reclaimed: {ticket.checklistToolsReclaimed ? CHECKLIST_ANSWER_LABELS[ticket.checklistToolsReclaimed] : "—"}</Text>
              <Text className="text-xs text-soliflex-gray-600">Machine cleaned: {ticket.checklistMachineCleaned ? CHECKLIST_ANSWER_LABELS[ticket.checklistMachineCleaned] : "—"}</Text>
              <Text className="text-xs text-soliflex-gray-600">Cable routing: {ticket.checklistCableRouting ? CHECKLIST_ANSWER_LABELS[ticket.checklistCableRouting] : "—"}</Text>
            </View>
          )}

          {ticket.qualityRating && (
            <View className="mt-3 rounded-lg border border-soliflex-gray-100 p-3">
              <Text className="mb-1 text-sm font-semibold text-soliflex-ink">Production feedback: {QUALITY_RATING_LABELS[ticket.qualityRating]}</Text>
              {ticket.qualityFeedback && <Text className="text-sm text-soliflex-gray-600">{ticket.qualityFeedback}</Text>}
            </View>
          )}

          {ticket.productionCertified && (
            <View className="mt-3 flex-row items-start gap-2 rounded-lg bg-green-50 p-3">
              <ShieldCheck color="#15803D" size={16} />
              <View className="flex-1">
                <Text className="text-xs text-green-800">{CERTIFY_STATEMENT}</Text>
                <Text className="mt-1 text-[10px] text-green-700">
                  Certified by {ticket.productionCertifiedBy?.name} on {ticket.productionCertifiedAt && formatIST(ticket.productionCertifiedAt)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions (comments) */}
        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Actions</Text>
          {ticket.comments?.length ? (
            ticket.comments.map((c, idx) => (
              <View key={c.id} className={`py-2 ${idx < ticket.comments!.length - 1 ? "border-b border-soliflex-gray-50" : ""}`}>
                <Text className="text-xs font-semibold text-soliflex-ink">{c.author?.name ?? "—"}</Text>
                <Text className="text-xs text-soliflex-gray-400">{formatIST(c.createdAt)}</Text>
                <Text className="mt-1 text-sm text-soliflex-gray-700">{c.body}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-soliflex-gray-500">No activity yet.</Text>
          )}
          <View className="mt-3 gap-2">
            <TextField placeholder="Add a note" value={comment} onChangeText={setComment} />
            <Button
              title="Add"
              variant="secondary"
              disabled={!comment.trim()}
              loading={mutations.addComment.isPending}
              onPress={() => mutations.addComment.mutate({ id: ticket.id, body: comment.trim() }, { onSuccess: () => setComment("") })}
            />
          </View>
        </View>

        <View className="mt-3 flex-row flex-wrap rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <InfoRow label="Machine" value={ticket.machine ? `${ticket.machine.name} (${ticket.machine.itemCode})` : "—"} />
          <InfoRow label="Reported by" value={ticket.reportedBy?.name ?? "—"} />
          <InfoRow label="Assigned to" value={ticket.assignedTo?.name ?? "Unassigned"} />
          <InfoRow label="Raised on" value={formatIST(ticket.createdAt, "dd MMM yyyy, HH:mm")} />
        </View>

        <View className="mt-3 gap-2 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <Text className="mb-1 text-sm font-semibold text-soliflex-ink">Workflow</Text>

          {canAcknowledge(ticket, user) && isMechanic && (
            <Button title="Acknowledge & assign to myself" onPress={() => mutations.acknowledge.mutate({ id: ticket.id })} loading={mutations.acknowledge.isPending} />
          )}
          {canAcknowledge(ticket, user) && isManager && <Button title="Acknowledge & assign" onPress={() => setShowAcknowledge(true)} />}

          {canStartProgress(ticket, user) && (
            <Button title="Start work" onPress={() => mutations.startProgress.mutate(ticket.id)} loading={mutations.startProgress.isPending} />
          )}

          {canMarkVerificationNeeded(ticket, user) && <Button title="Send for verification" onPress={() => setShowChecklist(true)} />}
          {canMaintHold(ticket, user) && <Button title="Put on hold" variant="secondary" onPress={() => setShowHold(true)} />}
          {canMaintResume(ticket, user) && (
            <Button title="Resume ticket" variant="secondary" onPress={() => mutations.maintResume.mutate(ticket.id)} loading={mutations.maintResume.isPending} />
          )}

          {canVerifyOrReject(ticket, user) && (
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title="Verify & close" onPress={() => setShowVerify(true)} />
              </View>
              <View className="flex-1">
                <Button title="Reject" variant="outline" onPress={() => setShowReject(true)} />
              </View>
            </View>
          )}

          {ticket.status === "VERIFICATION_NEEDED" && !canVerifyOrReject(ticket, user) && (
            <Text className="text-xs text-soliflex-gray-400">Waiting for the Production team to verify this fix.</Text>
          )}
          {ticket.status === "CLOSED" && <Text className="text-xs text-soliflex-gray-400">Closed. Maintenance tickets are not reopened.</Text>}
        </View>

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <CostSection ticket={ticket} canEdit={isManager || isTechnician} />
        </View>

        <View className="mt-3 rounded-xl border border-soliflex-gray-100 bg-white p-4">
          <AttachmentSection ticket={ticket} />
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
      </ScrollView>

      <AcknowledgeModal ticketId={ticket.id} visible={showAcknowledge} onClose={() => setShowAcknowledge(false)} />
      <MaintHoldModal ticketId={ticket.id} visible={showHold} onClose={() => setShowHold(false)} />
      <ChecklistModal ticketId={ticket.id} visible={showChecklist} onClose={() => setShowChecklist(false)} />
      <VerifyModal ticketId={ticket.id} visible={showVerify} onClose={() => setShowVerify(false)} />
      <RejectModal ticketId={ticket.id} visible={showReject} onClose={() => setShowReject(false)} />
    </SafeAreaView>
  );
}
