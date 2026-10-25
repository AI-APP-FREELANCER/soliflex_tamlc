import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { Ticket } from "@/lib/types";

interface CloseModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

/** Closes an IT ticket (the only workstream that still uses this simple close). */
export function CloseModal({ visible, ticket, onClose }: CloseModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [closingComment, setClosingComment] = useState("");
  const { closeDirect } = useTicketMutations(ticket.id);

  function handleSubmit() {
    closeDirect.mutate(
      { id: ticket.id, confirmEquipmentOperational: confirmed, closingComment: closingComment.trim() || undefined },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal visible={visible} title="Resolve & close" onClose={onClose}>
      <View className="gap-4 pb-4">
        <TextField
          label="Resolution note"
          placeholder="What was the problem and what did you do?"
          value={closingComment}
          onChangeText={setClosingComment}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
        <Pressable onPress={() => setConfirmed((v) => !v)} className="flex-row items-center gap-2">
          <View
            className={`h-5 w-5 items-center justify-center rounded border ${
              confirmed ? "border-soliflex-orange-500 bg-soliflex-orange-500" : "border-soliflex-gray-300"
            }`}
          >
            {confirmed && <Check color="#fff" size={14} />}
          </View>
          <Text className="flex-1 text-sm text-soliflex-ink">I confirm the issue is resolved</Text>
        </Pressable>
        <Button title="Close ticket" onPress={handleSubmit} disabled={!confirmed} loading={closeDirect.isPending} />
      </View>
    </Modal>
  );
}
