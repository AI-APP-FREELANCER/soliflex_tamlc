import { useState } from "react";
import { Text, View } from "react-native";
import { Modal } from "./Modal";
import { TextField } from "./TextField";
import { Button } from "./Button";

const MIN = 10;
const MAX = 1000;

/**
 * Every workflow transition requires a fresh Actions note (10-1000 chars,
 * re-enforced server-side) - this is the shared collector for transitions
 * that don't otherwise have a modal of their own (Start work, Resume, etc.).
 */
export function ActionNoteModal({
  visible,
  title,
  description,
  confirmLabel,
  onSubmit,
  onClose,
  pending,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onSubmit: (note: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const ok = trimmed.length >= MIN && trimmed.length <= MAX;

  return (
    <Modal visible={visible} title={title} onClose={onClose}>
      <View className="gap-4 pb-4">
        {description && <Text className="text-sm text-soliflex-gray-600">{description}</Text>}
        <View>
          <TextField
            label="Actions note (required)"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 72 }}
            placeholder={`Describe this update (${MIN}-${MAX} characters)`}
          />
          <Text className="mt-1 text-xs text-soliflex-gray-400">
            {trimmed.length}/{MAX}
          </Text>
        </View>
        <Button title={confirmLabel} onPress={() => ok && onSubmit(trimmed)} disabled={!ok} loading={pending} />
      </View>
    </Modal>
  );
}
