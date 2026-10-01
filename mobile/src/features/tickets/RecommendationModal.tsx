import { useState } from "react";
import { Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { Ticket } from "@/lib/types";

interface RecommendationModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

export function RecommendationModal({ visible, ticket, onClose }: RecommendationModalProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [recommendedFix, setRecommendedFix] = useState("");
  const { submitRecommendation } = useTicketMutations(ticket.id);

  const hasPreFixPhoto = !!ticket.attachments?.some((a) => a.type === "PRE_FIX_PHOTO");

  function handleSubmit() {
    submitRecommendation.mutate(
      { id: ticket.id, diagnosis: diagnosis.trim(), recommendedFix: recommendedFix.trim() },
      { onSuccess: onClose }
    );
  }

  const canSubmit = diagnosis.trim().length > 0 && recommendedFix.trim().length > 0;

  return (
    <Modal visible={visible} title="Submit diagnosis & fix" onClose={onClose}>
      <View className="gap-4 pb-4">
        {!hasPreFixPhoto && (
          <View className="rounded-lg bg-amber-50 p-3">
            <Text className="text-xs text-amber-800">
              No pre-fix photo uploaded yet. The server requires at least one before this can be submitted.
            </Text>
          </View>
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
          label="Recommended fix"
          placeholder="How will you fix it?"
          value={recommendedFix}
          onChangeText={setRecommendedFix}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
        <Text className="text-xs text-soliflex-gray-500">
          Submitting puts this ticket on hold pending your manager&apos;s approval.
        </Text>
        <Button title="Submit" onPress={handleSubmit} disabled={!canSubmit} loading={submitRecommendation.isPending} />
      </View>
    </Modal>
  );
}
