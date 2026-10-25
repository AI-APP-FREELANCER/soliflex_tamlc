import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

export function HoldModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [detail, setDetail] = useState("");
  const { hold } = useTicketMutations(ticket.id);

  async function handleSubmit() {
    await hold.mutateAsync({ id: ticket.id, detail });
    onClose();
  }

  return (
    <Modal title={`Put ${ticket.ticketNumber} on hold`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Why is this on hold?</label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" placeholder="e.g. Waiting on vendor" />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!detail || hold.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Put on hold
        </button>
      </div>
    </Modal>
  );
}
