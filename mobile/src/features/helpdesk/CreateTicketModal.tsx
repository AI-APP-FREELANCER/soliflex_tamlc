import { useState } from "react";
import { Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/Button";
import { HELPDESK_CATEGORY_LABELS } from "@/features/helpdesk/badges";
import { useHelpdeskMutations } from "@/features/helpdesk/hooks";
import type { HelpdeskCategory } from "@/lib/types";

const CATEGORY_OPTIONS = (Object.keys(HELPDESK_CATEGORY_LABELS) as HelpdeskCategory[]).map((value) => ({
  value,
  label: HELPDESK_CATEGORY_LABELS[value],
}));

interface CreateTicketModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateTicketModal({ visible, onClose }: CreateTicketModalProps) {
  const [category, setCategory] = useState<HelpdeskCategory>("LAPTOP_DESKTOP");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { create } = useHelpdeskMutations();

  function reset() {
    setCategory("LAPTOP_DESKTOP");
    setTitle("");
    setDescription("");
  }

  function handleSubmit() {
    create.mutate(
      { category, title: title.trim(), description: description.trim() },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  return (
    <Modal visible={visible} title="Raise a ticket" onClose={onClose}>
      <View className="gap-4 pb-4">
        <SelectField label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        <TextField label="Title" placeholder="Short summary" value={title} onChangeText={setTitle} />
        <View>
          <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">Description</Text>
          <TextField
            placeholder="What's the issue? Include any details that would help us fix it."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 96 }}
          />
        </View>
        <Button title="Raise ticket" onPress={handleSubmit} disabled={!canSubmit} loading={create.isPending} />
      </View>
    </Modal>
  );
}
