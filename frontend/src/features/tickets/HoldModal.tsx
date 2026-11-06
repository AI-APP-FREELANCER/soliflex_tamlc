import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

export function HoldModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [detail, setDetail] = useState("");
  const { hold } = useTicketMutations(ticket.id);
  const ok = detail.trim().length >= 10 && detail.trim().length <= 1000;

  async function handleSubmit() {
    if (!ok) return;
    await hold.mutateAsync({ id: ticket.id, detail: detail.trim() });
    onClose();
  }

  return (
    <Modal title={`Put ${ticket.ticketNumber} on hold`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Why is this on hold? (required)</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
            placeholder="e.g. Waiting on vendor (10-1000 characters)"
          />
          <p className="mt-1 text-xs text-soliflex-gray-400">{detail.trim().length}/1000</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!ok || hold.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Put on hold
        </button>
      </div>
    </Modal>
  );
}
