import { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { DateTimeField } from "@/components/DateTimeField";
import { Button } from "@/components/Button";
import { fetchUsers } from "@/api/users";
import { PRIORITY_LABELS } from "@/features/helpdesk/badges";
import { useHelpdeskMutations } from "@/features/helpdesk/hooks";
import type { HelpdeskTicket, Priority } from "@/lib/types";

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

interface AssignModalProps {
  visible: boolean;
  ticket: HelpdeskTicket;
  onClose: () => void;
}

export function AssignModal({ visible, ticket, onClose }: AssignModalProps) {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: visible });
  const engineers = useMemo(
    () => (users ?? []).filter((u) => u.role === "IT_SUPPORT_ENGINEER" && u.active),
    [users]
  );
  const engineerOptions = engineers.map((e) => ({ value: e.id, label: e.name }));

  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
  const [deadline, setDeadline] = useState<Date | undefined>(ticket.deadline ? new Date(ticket.deadline) : undefined);
  const [priority, setPriority] = useState<Priority>(ticket.priority ?? "MEDIUM");
  const { assign } = useHelpdeskMutations(ticket.id);

  function handleSubmit() {
    if (!assignedToId || !deadline) return;
    assign.mutate(
      { id: ticket.id, input: { assignedToId, deadline: deadline.toISOString(), priority } },
      { onSuccess: onClose }
    );
  }

  const canSubmit = !!assignedToId && !!deadline;

  return (
    <Modal visible={visible} title={ticket.assignedToId ? "Reassign ticket" : "Assign ticket"} onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField
          label="IT Support Engineer"
          value={assignedToId || undefined}
          options={engineerOptions}
          onChange={setAssignedToId}
        />
        <DateTimeField label="Deadline (IST)" value={deadline} onChange={setDeadline} minimumDate={new Date()} />
        <SelectField label="Priority" value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />
        <Button title="Assign" onPress={handleSubmit} disabled={!canSubmit} loading={assign.isPending} />
      </View>
    </Modal>
  );
}
