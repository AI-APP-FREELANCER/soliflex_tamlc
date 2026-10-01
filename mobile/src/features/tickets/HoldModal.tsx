import { useState } from "react";
import { View } from "react-native";
import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ON_HOLD_REASON_LABELS } from "@/features/tickets/badges";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { OnHoldReason, Ticket } from "@/lib/types";

const REASON_OPTIONS = (Object.keys(ON_HOLD_REASON_LABELS) as OnHoldReason[]).map((value) => ({
  value,
  label: ON_HOLD_REASON_LABELS[value],
}));

interface HoldModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

export function HoldModal({ visible, ticket, onClose }: HoldModalProps) {
  const [reason, setReason] = useState<OnHoldReason>("VENDOR");
  const [detail, setDetail] = useState("");
  const { hold } = useTicketMutations(ticket.id);

  function handleSubmit() {
    hold.mutate({ id: ticket.id, reason, detail: detail.trim() }, { onSuccess: onClose });
  }

  return (
    <Modal visible={visible} title="Put on hold" onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField label="Reason" value={reason} options={REASON_OPTIONS} onChange={setReason} />
        <TextField label="Detail" placeholder="e.g. Vendor ETA / which material" value={detail} onChangeText={setDetail} />
        <Button title="Put on hold" onPress={handleSubmit} disabled={!detail.trim()} loading={hold.isPending} />
      </View>
    </Modal>
  );
}
