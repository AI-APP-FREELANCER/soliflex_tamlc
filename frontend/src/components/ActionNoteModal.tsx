import { useState } from "react";
import { Modal } from "./Modal";

const MIN = 10;
const MAX = 1000;

/**
 * Every workflow transition requires a fresh Actions note (10-1000 chars,
 * re-enforced server-side) - this is the shared collector for transitions
 * that don't otherwise have a modal of their own (Start work, Resume, etc.).
 */
export function ActionNoteModal({
  title,
  description,
  confirmLabel,
  onSubmit,
  onClose,
  pending,
  tone = "primary",
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onSubmit: (note: string) => void;
  onClose: () => void;
  pending?: boolean;
  tone?: "primary" | "danger";
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const ok = trimmed.length >= MIN && trimmed.length <= MAX;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {description && <p className="text-sm text-soliflex-gray-600">{description}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Actions note (required)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={`Describe this update (${MIN}-${MAX} characters)`}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-soliflex-gray-400">{trimmed.length}/{MAX}</p>
        </div>
        <button
          onClick={() => ok && onSubmit(trimmed)}
          disabled={!ok || pending}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
            tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-soliflex-orange-500 hover:bg-soliflex-orange-600"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
