import { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { DateTimeField } from "@/components/DateTimeField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { fetchUsers } from "@/api/users";
import { PRIORITY_LABELS } from "@/features/helpdesk/badges";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { Priority, Ticket } from "@/lib/types";

// CRITICAL is retired for tickets (kept for Helpdesk, which still uses PRIORITY_LABELS directly).
const PRIORITY_OPTIONS = (["LOW", "MEDIUM", "HIGH"] as Priority[]).map((value) => ({ value, label: PRIORITY_LABELS[value] }));

interface AssignModalProps {
  visible: boolean;
  ticket: Ticket;
  onClose: () => void;
}

export function AssignModal({ visible, ticket, onClose }: AssignModalProps) {
  const isEdit = ticket.status !== "OPEN";
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: visible });
  const technicians = useMemo(
    () =>
      (users ?? []).filter((u) => {
        if (!u.active) return false;
        if (u.role === "EMPLOYEE") return ticket.workstream === "MAINTENANCE";
        return (u.role === "MECHANIC" || u.role === "IT_TEAM") && u.workstream === ticket.workstream;
      }),
    [users, ticket.workstream]
  );
  const options = technicians.map((t) => ({ value: t.id, label: t.name }));

  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
  const [priority, setPriority] = useState<Priority>(ticket.priority ?? "MEDIUM");
  const [note, setNote] = useState("");
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    ticket.targetCompletionDate ? new Date(ticket.targetCompletionDate) : undefined
  );
  const [effortHours, setEffortHours] = useState(ticket.effortEstimateHours?.toString() ?? "");
  const { assign, updateAssignment } = useTicketMutations(ticket.id);

  function handleSubmit() {
    if (isEdit) {
      updateAssignment.mutate(
        {
          id: ticket.id,
          input: {
            assignedToId: assignedToId || undefined,
            targetCompletionDate: targetDate ? targetDate.toISOString() : undefined,
            effortEstimateHours: effortHours ? Number(effortHours) : undefined,
          },
        },
        { onSuccess: onClose }
      );
      return;
    }
    if (!assignedToId || !noteOk) return;
    assign.mutate(
      {
        id: ticket.id,
        input: {
          assignedToId,
          priority,
          note: note.trim(),
          targetCompletionDate: targetDate ? targetDate.toISOString() : undefined,
          effortEstimateHours: effortHours ? Number(effortHours) : undefined,
        },
      },
      { onSuccess: onClose }
    );
  }

  const noteOk = isEdit || (note.trim().length >= 10 && note.trim().length <= 1000);
  const canSubmit = isEdit ? true : !!assignedToId && noteOk;
  const pending = assign.isPending || updateAssignment.isPending;

  return (
    <Modal visible={visible} title={isEdit ? "Edit assignment" : "Assign technician"} onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField
          label={isEdit ? "Technician (leave to keep current)" : "Technician"}
          value={assignedToId || undefined}
          options={options}
          onChange={setAssignedToId}
        />
        {!isEdit && <SelectField label="Priority" value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />}
        {!isEdit && (
          <TextField
            label="Actions note (required)"
            placeholder="Describe this assignment (10-1000 characters)"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 56 }}
          />
        )}
        <DateTimeField label="Target completion (optional)" value={targetDate} onChange={setTargetDate} minimumDate={new Date()} />
        <TextField
          label="Effort estimate, hours (optional)"
          placeholder="e.g. 4"
          value={effortHours}
          onChangeText={setEffortHours}
          keyboardType="numeric"
        />
        <Button title={isEdit ? "Save" : "Assign"} onPress={handleSubmit} disabled={!canSubmit} loading={pending} />
      </View>
    </Modal>
  );
}
