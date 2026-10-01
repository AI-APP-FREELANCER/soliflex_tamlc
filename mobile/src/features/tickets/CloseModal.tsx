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

export function CloseModal({ visible, ticket, onClose }: CloseModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [closingComment, setClosingComment] = useState("");
  const { close } = useTicketMutations(ticket.id);

  const hasPostFixPhoto = !!ticket.attachments?.some((a) => a.type === "POST_FIX_PHOTO");

  function handleSubmit() {
    close.mutate(
      { id: ticket.id, confirmEquipmentOperational: confirmed, closingComment: closingComment.trim() || undefined },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal visible={visible} title="Verify & close ticket" onClose={onClose}>
      <View className="gap-4 pb-4">
        {!hasPostFixPhoto && (
          <View className="rounded-lg bg-amber-50 p-3">
            <Text className="text-xs text-amber-800">
              No post-fix photo has been uploaded yet. The server will reject closing without at least one.
            </Text>
          </View>
        )}
        <TextField
          label="Closing comment"
          placeholder="Summary of the fix (required if there are no comments yet)"
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
          <Text className="flex-1 text-sm text-soliflex-ink">I confirm the equipment is operational</Text>
        </Pressable>
        <Button title="Close ticket" onPress={handleSubmit} disabled={!confirmed} loading={close.isPending} />
      </View>
    </Modal>
  );
}
