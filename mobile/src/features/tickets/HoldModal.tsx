import { useState } from "react";
import { View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { Ticket } from "@/lib/types";

interface HoldModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

export function HoldModal({ visible, ticket, onClose }: HoldModalProps) {
  const [detail, setDetail] = useState("");
  const { hold } = useTicketMutations(ticket.id);

  function handleSubmit() {
    hold.mutate({ id: ticket.id, detail: detail.trim() }, { onSuccess: onClose });
  }

  return (
    <Modal visible={visible} title="Put on hold" onClose={onClose}>
      <View className="gap-4 pb-4">
        <TextField label="Why is this on hold?" placeholder="e.g. Waiting on vendor" value={detail} onChangeText={setDetail} />
        <Button title="Put on hold" onPress={handleSubmit} disabled={!detail.trim()} loading={hold.isPending} />
      </View>
    </Modal>
  );
}
