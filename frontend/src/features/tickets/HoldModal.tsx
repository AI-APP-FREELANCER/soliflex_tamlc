import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { OnHoldReason, Ticket } from "../../lib/types";

const REASON_LABELS: Record<OnHoldReason, string> = {
  VENDOR: "Waiting for Vendor",
  MATERIAL: "Waiting for Material (ETA)",
  APPROVAL: "Waiting for Approval",
};

export function HoldModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [reason, setReason] = useState<OnHoldReason>("VENDOR");
  const [detail, setDetail] = useState("");
  const { hold } = useTicketMutations(ticket.id);

  async function handleSubmit() {
    await hold.mutateAsync({ id: ticket.id, data: { reason, detail } });
    onClose();
  }

  return (
    <Modal title={`Put ${ticket.ticketNumber} on hold`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as OnHoldReason)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            {(Object.keys(REASON_LABELS) as OnHoldReason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">
            {reason === "MATERIAL" ? "Expected ETA / detail" : reason === "APPROVAL" ? "Pending approver" : "Vendor / detail"}
          </label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
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
