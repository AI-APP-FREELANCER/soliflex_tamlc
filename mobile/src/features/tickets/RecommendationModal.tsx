import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { FixType, Ticket } from "@/lib/types";

interface RecommendationModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

const FIX_TYPES: { value: FixType; label: string; hint: string }[] = [
  { value: "MINOR_ADJUSTMENT", label: "Minor adjustment", hint: "No spare part needed. You can close the ticket yourself with a photo." },
  { value: "SPARE_PART_REPLACEMENT", label: "Spare part replacement", hint: "A part has to be replaced. Its cost decides whether your manager must approve." },
];

export function RecommendationModal({ visible, ticket, onClose }: RecommendationModalProps) {
  const threshold = ticket.approvalThreshold ?? 2500;
  const [fixType, setFixType] = useState<FixType | null>(ticket.fixType);
  const [estimatedCost, setEstimatedCost] = useState(ticket.estimatedCost ? String(ticket.estimatedCost) : "");
  const [diagnosis, setDiagnosis] = useState("");
  const [recommendedFix, setRecommendedFix] = useState("");
  const { submitRecommendation } = useTicketMutations(ticket.id);

  const hasPreFixPhoto = !!ticket.attachments?.some((a) => a.type === "PRE_FIX_PHOTO");
  const needsCost = fixType === "SPARE_PART_REPLACEMENT";
  const cost = Number(estimatedCost);
  const effective = needsCost ? Math.max(cost || 0, ticket.actualCost ?? 0) : ticket.actualCost ?? 0;
  const approvalNeeded = fixType !== null && effective >= threshold;
  const canSubmit = diagnosis.trim().length > 0 && recommendedFix.trim().length > 0 && fixType !== null && (!needsCost || cost > 0);
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  function handleSubmit() {
    if (!fixType) return;
    submitRecommendation.mutate(
      {
        id: ticket.id,
        diagnosis: diagnosis.trim(),
        recommendedFix: recommendedFix.trim(),
        fixType,
        estimatedCost: needsCost ? cost : undefined,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal visible={visible} title="Diagnosis & fix" onClose={onClose}>
      <View className="gap-4 pb-4">
        {!hasPreFixPhoto && (
          <View className="rounded-lg bg-amber-50 p-3">
            <Text className="text-xs text-amber-800">
              No pre-fix photo uploaded yet. The server requires at least one before this can be submitted.
            </Text>
          </View>
        )}

        <View>
          <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">What does the fix need?</Text>
          <View className="gap-2">
            {FIX_TYPES.map((t) => {
              const active = fixType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setFixType(t.value)}
                  className={`rounded-lg border px-3 py-3 ${active ? "border-soliflex-orange-500 bg-soliflex-orange-50" : "border-soliflex-gray-200"}`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-soliflex-orange-700" : "text-soliflex-ink"}`}>{t.label}</Text>
                  <Text className="mt-0.5 text-xs text-soliflex-gray-500">{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {needsCost && (
          <TextField
            label="Estimated cost of the spare part (₹)"
            placeholder="e.g. 1800"
            value={estimatedCost}
            onChangeText={setEstimatedCost}
            keyboardType="numeric"
          />
        )}

        <TextField
          label="Diagnosis"
          placeholder="What's wrong?"
          value={diagnosis}
          onChangeText={setDiagnosis}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
        <TextField
          label={fixType === "MINOR_ADJUSTMENT" ? "Adjustment made" : "Recommended fix"}
          placeholder="How will you fix it?"
          value={recommendedFix}
          onChangeText={setRecommendedFix}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />

        {fixType && (
          <View className={`rounded-lg p-3 ${approvalNeeded ? "bg-amber-50" : "bg-green-50"}`}>
            <Text className={`text-xs ${approvalNeeded ? "text-amber-800" : "text-green-800"}`}>
              {approvalNeeded
                ? `Costs of ${inr(threshold)} or more need your manager's approval. The ticket goes on hold until it is approved.`
                : `No manager approval needed${needsCost ? ` (under ${inr(threshold)})` : ""}. After the fix, upload a post-fix photo and close the ticket yourself.`}
            </Text>
          </View>
        )}

        <Button
          title={approvalNeeded ? "Submit for approval" : "Save diagnosis"}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitRecommendation.isPending}
        />
      </View>
    </Modal>
  );
}
