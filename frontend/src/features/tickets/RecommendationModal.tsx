import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useTicketMutations } from "./hooks";
import type { FixType, Ticket } from "../../lib/types";

const FIX_TYPES: { value: FixType; label: string; hint: string }[] = [
  { value: "MINOR_ADJUSTMENT", label: "Minor adjustment", hint: "No spare part needed. You can close the ticket yourself with a photo." },
  { value: "SPARE_PART_REPLACEMENT", label: "Spare part replacement", hint: "A part has to be replaced. Cost decides whether the manager must approve." },
];

export function RecommendationModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const threshold = ticket.approvalThreshold ?? 2500;
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis ?? "");
  const [recommendedFix, setRecommendedFix] = useState(ticket.recommendedFix ?? "");
  const [fixType, setFixType] = useState<FixType | null>(ticket.fixType);
  const [estimatedCost, setEstimatedCost] = useState(ticket.estimatedCost ? String(ticket.estimatedCost) : "");
  const { submitRecommendation } = useTicketMutations(ticket.id);

  const cost = Number(estimatedCost);
  const needsCost = fixType === "SPARE_PART_REPLACEMENT";
  const effective = needsCost ? Math.max(cost || 0, ticket.actualCost ?? 0) : ticket.actualCost ?? 0;
  const approvalNeeded = fixType !== null && effective >= threshold;
  const valid = !!diagnosis.trim() && !!recommendedFix.trim() && fixType !== null && (!needsCost || cost > 0);

  async function handleSubmit() {
    if (!fixType) return;
    await submitRecommendation.mutateAsync({
      id: ticket.id,
      data: { diagnosis, recommendedFix, fixType, estimatedCost: needsCost ? cost : undefined },
    });
    onClose();
  }

  return (
    <Modal title="Diagnosis & fix" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">What does the fix need?</label>
          <div className="grid grid-cols-2 gap-2">
            {FIX_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFixType(t.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${
                  fixType === t.value ? "border-soliflex-orange-500 bg-soliflex-orange-50 text-soliflex-orange-700" : "border-soliflex-gray-200 text-soliflex-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {fixType && <p className="mt-1 text-xs text-soliflex-gray-400">{FIX_TYPES.find((t) => t.value === fixType)?.hint}</p>}
        </div>

        {needsCost && (
          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Estimated cost of the spare part (₹)</label>
            <input
              type="number"
              min={1}
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="e.g. 1800"
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Diagnosis</label>
          <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">{fixType === "MINOR_ADJUSTMENT" ? "Adjustment made" : "Recommended fix"}</label>
          <textarea value={recommendedFix} onChange={(e) => setRecommendedFix(e.target.value)} rows={3} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>

        {fixType && (
          <p className={`rounded-md px-3 py-2 text-xs ${approvalNeeded ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
            {approvalNeeded
              ? `Costs of ₹${threshold.toLocaleString("en-IN")} or more need your manager's approval. The ticket goes on hold until it is approved.`
              : `No manager approval needed${needsCost ? ` (under ₹${threshold.toLocaleString("en-IN")})` : ""}. After the fix, upload a post-fix photo and close the ticket yourself.`}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!valid || submitRecommendation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          {approvalNeeded ? "Submit for approval" : "Save diagnosis"}
        </button>
      </div>
    </Modal>
  );
}
