import { useMemo, useState } from "react";
import { View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { AssetPicker } from "@/components/AssetPicker";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth.store";
import { TICKET_CATEGORY_LABELS } from "@/features/tickets/badges";
import { allowedCategoriesForCreate, allowedWorkstreamsForCreate } from "@/features/tickets/permissions";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { TicketCategory, Workstream } from "@/lib/types";

interface CreateTicketModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
}

export function CreateTicketModal({ visible, onClose, onCreated }: CreateTicketModalProps) {
  const user = useAuthStore((s) => s.user);
  const workstreamOptions = useMemo(() => allowedWorkstreamsForCreate(user?.role, user?.workstream), [user?.role, user?.workstream]);

  const [workstream, setWorkstream] = useState<Workstream | undefined>(workstreamOptions[0]);
  const [category, setCategory] = useState<TicketCategory | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plantLocation, setPlantLocation] = useState("");
  const [assetId, setAssetId] = useState<string | undefined>();
  const [assetLabel, setAssetLabel] = useState<string | undefined>();
  const { create } = useTicketMutations();

  const categoryOptions = useMemo(
    () => (workstream ? allowedCategoriesForCreate(user?.role, workstream).map((v) => ({ value: v, label: TICKET_CATEGORY_LABELS[v] })) : []),
    [user?.role, workstream]
  );

  function reset() {
    setWorkstream(workstreamOptions[0]);
    setCategory(undefined);
    setTitle("");
    setDescription("");
    setPlantLocation("");
    setAssetId(undefined);
    setAssetLabel(undefined);
  }

  function handleSubmit() {
    if (!workstream || !category) return;
    create.mutate(
      {
        workstream,
        category,
        title: title.trim(),
        description: description.trim(),
        plantLocation: plantLocation.trim() || undefined,
        maintenanceAssetId: workstream === "MAINTENANCE" ? assetId : undefined,
        itAssetId: workstream === "IT" ? assetId : undefined,
      },
      {
        onSuccess: (ticket) => {
          reset();
          onClose();
          onCreated?.(ticket.id);
        },
      }
    );
  }

  const canSubmit = !!workstream && !!category && title.trim().length >= 3 && description.trim().length >= 3;

  if (workstreamOptions.length === 0) {
    return (
      <Modal visible={visible} title="Raise a ticket" onClose={onClose}>
        <View className="pb-4">
          <TextField editable={false} value="Your role cannot raise maintenance/IT tickets." />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} title="Raise a ticket" onClose={onClose}>
      <View className="gap-4 pb-4">
        {workstreamOptions.length > 1 && (
          <SelectField
            label="Workstream"
            value={workstream}
            options={workstreamOptions.map((v) => ({ value: v, label: v === "MAINTENANCE" ? "Maintenance" : "IT" }))}
            onChange={(v) => {
              setWorkstream(v);
              setCategory(undefined);
              setAssetId(undefined);
              setAssetLabel(undefined);
            }}
          />
        )}
        <SelectField label="Category" value={category} options={categoryOptions} onChange={setCategory} />
        <TextField label="Title" placeholder="Short summary (at least 3 characters)" value={title} onChangeText={setTitle} />
        <TextField
          label="Description"
          placeholder="What's the issue? (at least 3 characters)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 96 }}
        />
        <TextField label="Plant / location (optional)" placeholder="e.g. Line 3, Shop Floor" value={plantLocation} onChangeText={setPlantLocation} />
        {workstream && (
          <AssetPicker
            type={workstream === "MAINTENANCE" ? "maintenance" : "it"}
            selectedLabel={assetLabel}
            onSelect={(id, l) => {
              setAssetId(id);
              setAssetLabel(l);
            }}
            onClear={() => {
              setAssetId(undefined);
              setAssetLabel(undefined);
            }}
          />
        )}
        <Button title="Raise ticket" onPress={handleSubmit} disabled={!canSubmit} loading={create.isPending} />
      </View>
    </Modal>
  );
}
