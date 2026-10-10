import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

/**
 * Closes a ticket. `direct` is the engineer/manager fast close (no review chain);
 * otherwise it is the manager's final "verify & close" from Final Review.
 */
export function CloseModal({ ticket, onClose, direct = false }: { ticket: Ticket; onClose: () => void; direct?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [closingComment, setClosingComment] = useState("");
  const { close, closeDirect } = useTicketMutations(ticket.id);
  const mutation = direct ? closeDirect : close;
  const isIT = ticket.workstream === "IT";

  const needsPhoto = !isIT;
  const hasPostFixPhoto = ticket.attachments.some((a) => a.type === "POST_FIX_PHOTO");

  async function handleSubmit() {
    await mutation.mutateAsync({ id: ticket.id, data: { confirmEquipmentOperational: confirm, closingComment: closingComment || undefined } });
    onClose();
  }

  return (
    <Modal title={`Close ${ticket.ticketNumber}`} onClose={onClose}>
      <div className="space-y-4">
        {needsPhoto && !hasPostFixPhoto && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No post-fix photo has been uploaded yet. Upload one from the ticket before closing.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">{isIT ? "Resolution note" : "Closing comment"}</label>
          <textarea
            value={closingComment}
            onChange={(e) => setClosingComment(e.target.value)}
            rows={3}
            placeholder={isIT ? "What was the problem and what did you do?" : "Summarize the resolution and final verification"}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-soliflex-gray-700">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          {isIT
            ? "I confirm the issue is resolved."
            : direct
              ? "I confirm the job is done and the machine/equipment is operational."
              : "I have verified the task comments, photos, and confirm the machine/equipment is operational."}
        </label>
        <button
          onClick={handleSubmit}
          disabled={!confirm || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          {direct ? "Close ticket" : "Verify & close"}
        </button>
      </div>
    </Modal>
  );
}
