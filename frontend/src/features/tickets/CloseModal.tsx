import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

/** Closes an IT ticket (the only workstream that still uses this simple close). */
export function CloseModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [closingComment, setClosingComment] = useState("");
  const { closeDirect } = useTicketMutations(ticket.id);
  const noteOk = closingComment.trim().length >= 10 && closingComment.trim().length <= 1000;

  async function handleSubmit() {
    if (!noteOk) return;
    await closeDirect.mutateAsync({ id: ticket.id, data: { confirmEquipmentOperational: confirm, closingComment: closingComment.trim() } });
    onClose();
  }

  return (
    <Modal title={`Close ${ticket.ticketNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Resolution note (required)</label>
          <textarea
            value={closingComment}
            onChange={(e) => setClosingComment(e.target.value)}
            rows={3}
            placeholder="What was the problem and what did you do? (10-1000 characters)"
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-soliflex-gray-400">{closingComment.trim().length}/1000</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-soliflex-gray-700">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          I confirm the issue is resolved.
        </label>
        <button
          onClick={handleSubmit}
          disabled={!confirm || !noteOk || closeDirect.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Close ticket
        </button>
      </div>
    </Modal>
  );
}
