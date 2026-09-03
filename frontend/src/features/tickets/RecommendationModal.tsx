import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { Ticket } from "../../lib/types";

export function RecommendationModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis ?? "");
  const [recommendedFix, setRecommendedFix] = useState(ticket.recommendedFix ?? "");
  const { submitRecommendation } = useTicketMutations(ticket.id);

  async function handleSubmit() {
    await submitRecommendation.mutateAsync({ id: ticket.id, data: { diagnosis, recommendedFix } });
    onClose();
  }

  return (
    <Modal title="Diagnosis & recommended fix" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Diagnosis</label>
          <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Recommended fix</label>
          <textarea value={recommendedFix} onChange={(e) => setRecommendedFix(e.target.value)} rows={3} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-soliflex-gray-400">This sends the ticket on-hold, awaiting your manager's approval before you execute the fix.</p>
        <button
          onClick={handleSubmit}
          disabled={!diagnosis || !recommendedFix || submitRecommendation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Submit for approval
        </button>
      </div>
    </Modal>
  );
}
