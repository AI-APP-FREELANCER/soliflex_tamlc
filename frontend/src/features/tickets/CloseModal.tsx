import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

export function CloseModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [confirmEquipmentOperational, setConfirm] = useState(false);
  const [closingComment, setClosingComment] = useState("");
  const { close } = useTicketMutations(ticket.id);

  const hasPostFixPhoto = ticket.attachments.some((a) => a.type === "POST_FIX_PHOTO");

  async function handleSubmit() {
    await close.mutateAsync({ id: ticket.id, data: { confirmEquipmentOperational, closingComment: closingComment || undefined } });
    onClose();
  }

  return (
    <Modal title={`Close ${ticket.ticketNumber}`} onClose={onClose}>
      <div className="space-y-4">
        {!hasPostFixPhoto && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No post-fix photo has been uploaded yet. The server will reject closure until one is added.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Closing comment</label>
          <textarea
            value={closingComment}
            onChange={(e) => setClosingComment(e.target.value)}
            rows={3}
            placeholder="Summarize the resolution and final verification"
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-soliflex-gray-700">
          <input type="checkbox" checked={confirmEquipmentOperational} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          I have verified the task comments, photos, and confirm the machine/equipment is operational.
        </label>
        <button
          onClick={handleSubmit}
          disabled={!confirmEquipmentOperational || close.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Verify &amp; close
        </button>
      </div>
    </Modal>
  );
}
