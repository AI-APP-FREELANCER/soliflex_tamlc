import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, IndianRupee, PlayCircle, PauseCircle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useTicket, useTicketMutations } from "./hooks";
import { useAuthStore } from "../../store/auth.store";
import { Spinner } from "../../components/Spinner";
import { Modal } from "../../components/Modal";
import { StatusBadge, PriorityBadge, MachineStatusBadge, QualityRatingBadge, PROBLEM_TYPE_LABELS, DELAY_REASON_LABELS, CHECKLIST_ANSWER_LABELS } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { API_BASE_URL } from "../../lib/api";
import { fetchUsers } from "../users/api";
import type { AttachmentType, ChecklistAnswer, DelayReason, QualityRating } from "../../lib/types";

const ATTACHMENT_LABELS: Record<AttachmentType, string> = {
  PRE_FIX_PHOTO: "Pre-fix photo",
  POST_FIX_PHOTO: "Post-fix photo",
  INVOICE: "Invoice",
  OTHER: "Other",
};

const DELAY_REASONS: DelayReason[] = ["TECHNICIAN_NOT_AVAILABLE", "WAITING_FOR_SPARES", "WAITING_FOR_EXTERNAL_SERVICE", "NEED_TECHNICAL_SUPPORT", "OTHERS"];
const QUALITY_RATINGS: QualityRating[] = ["EXCELLENT", "GOOD", "FAIR", "POOR"];
const CHECKLIST_ANSWERS: ChecklistAnswer[] = ["YES", "NO", "NA"];
const CERTIFY_STATEMENT = "I certify that the asset/machine has been repaired and is now in safe, workable condition.";

// ---------------------------------------------------------------- modals ---

function AcknowledgeModal({ ticketId, isManager, onClose }: { ticketId: string; isManager: boolean; onClose: () => void }) {
  const { data: users = [] } = useQuery({ queryKey: ["users", "MAINTENANCE"], queryFn: () => fetchUsers("MAINTENANCE") });
  const mechanics = users.filter((u) => u.active && u.role === "MECHANIC");
  const [assigneeId, setAssigneeId] = useState("");
  const { acknowledge } = useTicketMutations(ticketId);

  async function handleSubmit() {
    await acknowledge.mutateAsync({ id: ticketId, assigneeId: assigneeId || undefined });
    onClose();
  }

  return (
    <Modal title="Acknowledge & assign" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Assign to</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="" disabled>
              Select a mechanic
            </option>
            {mechanics.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-soliflex-gray-400">
          {isManager
            ? "Acknowledging and assigning happen together - the ticket moves straight to Acknowledged."
            : "This assigns the ticket to the selected mechanic and marks it Acknowledged."}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!assigneeId || acknowledge.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Acknowledge
        </button>
      </div>
    </Modal>
  );
}

function MaintHoldModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [useReason, setUseReason] = useState(false);
  const [delayReason, setDelayReason] = useState<DelayReason>("WAITING_FOR_SPARES");
  const [delayNotes, setDelayNotes] = useState("");
  const { maintHold } = useTicketMutations(ticketId);

  const notesOk = !useReason || (delayNotes.trim().length >= 10 && delayNotes.trim().length <= 300);

  async function handleSubmit() {
    await maintHold.mutateAsync({ id: ticketId, data: useReason ? { delayReason, delayNotes: delayNotes.trim() } : {} });
    onClose();
  }

  return (
    <Modal title="Put on hold" onClose={onClose}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-soliflex-gray-700">
          <input type="checkbox" checked={useReason} onChange={(e) => setUseReason(e.target.checked)} />
          Record a reason for the delay (optional)
        </label>
        {useReason && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Reason for delay</label>
              <select value={delayReason} onChange={(e) => setDelayReason(e.target.value as DelayReason)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
                {DELAY_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {DELAY_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Notes</label>
              <textarea
                value={delayNotes}
                onChange={(e) => setDelayNotes(e.target.value)}
                rows={3}
                placeholder="10-300 characters"
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-soliflex-gray-400">{delayNotes.trim().length}/300</p>
            </div>
          </>
        )}
        <button
          onClick={handleSubmit}
          disabled={!notesOk || maintHold.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Put on hold
        </button>
      </div>
    </Modal>
  );
}

function ChecklistModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [toolsReclaimed, setToolsReclaimed] = useState<ChecklistAnswer | "">("");
  const [machineCleaned, setMachineCleaned] = useState<ChecklistAnswer | "">("");
  const [cableRouting, setCableRouting] = useState<ChecklistAnswer | "">("");
  const { markVerificationNeeded } = useTicketMutations(ticketId);

  const complete = !!toolsReclaimed && !!machineCleaned && !!cableRouting;

  async function handleSubmit() {
    if (!complete) return;
    await markVerificationNeeded.mutateAsync({ id: ticketId, data: { toolsReclaimed, machineCleaned, cableRouting } });
    onClose();
  }

  const Row = ({ label, value, onChange }: { label: string; value: ChecklistAnswer | ""; onChange: (v: ChecklistAnswer) => void }) => (
    <div>
      <p className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</p>
      <div className="flex gap-3">
        {CHECKLIST_ANSWERS.map((a) => (
          <label key={a} className="flex items-center gap-1.5 text-sm text-soliflex-gray-700">
            <input type="radio" checked={value === a} onChange={() => onChange(a)} /> {CHECKLIST_ANSWER_LABELS[a]}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Modal title="Post-maintenance checklist (5S)" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-soliflex-gray-500">Confirm all three before sending this to Production for verification.</p>
        <Row label="All tools reclaimed (5S)" value={toolsReclaimed} onChange={setToolsReclaimed} />
        <Row label="Machine cleaned against dust / oil (5S)" value={machineCleaned} onChange={setMachineCleaned} />
        <Row label="Proper cable routing (5S)" value={cableRouting} onChange={setCableRouting} />
        <button
          onClick={handleSubmit}
          disabled={!complete || markVerificationNeeded.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Send for verification
        </button>
      </div>
    </Modal>
  );
}

function VerifyModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [qualityRating, setQualityRating] = useState<QualityRating | "">("");
  const [qualityFeedback, setQualityFeedback] = useState("");
  const [certify, setCertify] = useState(false);
  const { verifyAndClose } = useTicketMutations(ticketId);

  async function handleSubmit() {
    if (!qualityRating || !certify) return;
    await verifyAndClose.mutateAsync({ id: ticketId, data: { qualityRating, qualityFeedback: qualityFeedback.trim() || undefined, certify: true } });
    onClose();
  }

  return (
    <Modal title="Verify & close" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Quality of the maintenance resolution</label>
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_RATINGS.map((r) => (
              <button
                key={r}
                onClick={() => setQualityRating(r)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  qualityRating === r ? "border-soliflex-orange-500 bg-soliflex-orange-50 text-soliflex-orange-700" : "border-soliflex-gray-200 text-soliflex-gray-600"
                }`}
              >
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Feedback (optional)</label>
          <textarea value={qualityFeedback} onChange={(e) => setQualityFeedback(e.target.value)} rows={2} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-soliflex-gray-50 p-3 text-sm text-soliflex-gray-700">
          <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} className="mt-0.5" />
          {CERTIFY_STATEMENT}
        </label>
        <button
          onClick={handleSubmit}
          disabled={!qualityRating || !certify || verifyAndClose.isPending}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          Verify & close
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const { rejectVerification } = useTicketMutations(ticketId);

  async function handleSubmit() {
    if (!reason.trim()) return;
    await rejectVerification.mutateAsync({ id: ticketId, data: { reason: reason.trim() } });
    onClose();
  }

  return (
    <Modal title="Reject the fix" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-soliflex-gray-600">This sends the ticket back to the maintenance team to work on again.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="What still needs fixing?"
          className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={!reason.trim() || rejectVerification.isPending}
          className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject & send back
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- page ---

export default function MaintenanceTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, isLoading } = useTicket(id);
  const mutations = useTicketMutations(id);

  const [comment, setComment] = useState("");
  const [showAcknowledge, setShowAcknowledge] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costIsPart, setCostIsPart] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<AttachmentType>("PRE_FIX_PHOTO");

  if (isLoading || !ticket) return <Spinner />;

  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const isMechanic = user?.role === "MECHANIC";
  const isProduction = user?.role === "PRODUCTION" || isManager;
  const isAssignee = ticket.assignedToId === user?.id;

  async function handleAction(fn: () => Promise<any>) {
    // The mutation itself already toasts on error (see useTicketMutations'
    // wrap()) - this catch exists only to swallow the rejection so it
    // doesn't surface as an unhandled promise rejection.
    try {
      await fn();
    } catch {
      // handled by the mutation's own onError
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !id) return;
    for (const file of Array.from(files)) {
      await mutations.addAttachment.mutateAsync({ id, file, type: pendingUploadType });
    }
  }

  const hasChecklist = ticket.checklistToolsReclaimed || ticket.checklistMachineCleaned || ticket.checklistCableRouting;

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-soliflex-gray-500 hover:text-soliflex-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Actions (renamed from Comments, moved to the top) */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Actions</h2>
            <div className="mb-4 space-y-3">
              {ticket.comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.author.name} size={26} />
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold text-soliflex-ink">{c.author.name}</span>{" "}
                      <span className="text-xs text-soliflex-gray-400">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </p>
                    <p className="text-sm text-soliflex-gray-600">{c.body}</p>
                  </div>
                </div>
              ))}
              {ticket.comments.length === 0 && <p className="text-sm text-soliflex-gray-400">No activity yet.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note"
                className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment && id) {
                    mutations.addComment.mutate({ id, body: comment });
                    setComment("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (!comment || !id) return;
                  mutations.addComment.mutate({ id, body: comment });
                  setComment("");
                }}
                className="rounded-lg bg-soliflex-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
              >
                Add
              </button>
            </div>
          </div>

          {/* Ticket info */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-soliflex-gray-400">{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <MachineStatusBadge status={ticket.machineStatus} />
            </div>
            <h1 className="text-lg font-bold text-soliflex-ink">{ticket.displayTitle}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-soliflex-gray-500">
              {ticket.machine && <span>Machine: {ticket.machine.name} ({ticket.machine.itemCode})</span>}
              {ticket.plant && <span>Plant: {ticket.plant.name}</span>}
              {ticket.department && <span>Dept: {ticket.department.name}</span>}
              {ticket.problemType && <span>Problem: {PROBLEM_TYPE_LABELS[ticket.problemType]}</span>}
            </div>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-soliflex-gray-400">Problem Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-soliflex-gray-600">{ticket.description}</p>

            {ticket.status === "ON_HOLD" && (
              <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                On hold{ticket.delayReason && <> — {DELAY_REASON_LABELS[ticket.delayReason]}</>}
                {ticket.delayNotes && <p className="mt-1 text-xs">{ticket.delayNotes}</p>}
              </div>
            )}

            {!!hasChecklist && (
              <div className="mt-4 rounded-lg border border-soliflex-gray-100 bg-soliflex-gray-50 p-3 text-sm">
                <p className="mb-1 font-semibold text-soliflex-ink">Post-maintenance checklist (5S)</p>
                <ul className="space-y-0.5 text-soliflex-gray-600">
                  <li>Tools reclaimed: {ticket.checklistToolsReclaimed ? CHECKLIST_ANSWER_LABELS[ticket.checklistToolsReclaimed] : "—"}</li>
                  <li>Machine cleaned: {ticket.checklistMachineCleaned ? CHECKLIST_ANSWER_LABELS[ticket.checklistMachineCleaned] : "—"}</li>
                  <li>Cable routing: {ticket.checklistCableRouting ? CHECKLIST_ANSWER_LABELS[ticket.checklistCableRouting] : "—"}</li>
                </ul>
              </div>
            )}

            {ticket.qualityRating && (
              <div className="mt-4 rounded-lg border border-soliflex-gray-100 p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-semibold text-soliflex-ink">
                  Production feedback <QualityRatingBadge rating={ticket.qualityRating} />
                </p>
                {ticket.qualityFeedback && <p className="text-soliflex-gray-600">{ticket.qualityFeedback}</p>}
              </div>
            )}

            {ticket.productionCertified && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{CERTIFY_STATEMENT}</p>
                  <p className="mt-1 text-xs text-green-700">
                    Certified by {ticket.productionCertifiedBy?.name} on {ticket.productionCertifiedAt && format(new Date(ticket.productionCertifiedAt), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-soliflex-ink">Attachments</h2>
              <div className="flex items-center gap-2">
                <select
                  value={pendingUploadType}
                  onChange={(e) => setPendingUploadType(e.target.value as AttachmentType)}
                  className="rounded-md border border-soliflex-gray-200 px-2 py-1 text-xs"
                >
                  {(Object.keys(ATTACHMENT_LABELS) as AttachmentType[]).map((t) => (
                    <option key={t} value={t}>
                      {ATTACHMENT_LABELS[t]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-md bg-soliflex-gray-100 px-2.5 py-1.5 text-xs font-semibold text-soliflex-gray-700 hover:bg-soliflex-gray-200"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Upload
                </button>
                <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
              </div>
            </div>
            {ticket.attachments.length === 0 ? (
              <p className="text-sm text-soliflex-gray-400">No files uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ticket.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`${API_BASE_URL}${a.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-soliflex-gray-100 p-2 text-xs hover:border-soliflex-orange-300"
                  >
                    {a.mimeType.startsWith("image/") ? (
                      <img src={`${API_BASE_URL}${a.fileUrl}`} className="mb-1 h-20 w-full rounded object-cover" />
                    ) : (
                      <div className="mb-1 flex h-20 w-full items-center justify-center rounded bg-soliflex-gray-50 text-soliflex-gray-400">PDF</div>
                    )}
                    <p className="truncate font-medium text-soliflex-ink">{ATTACHMENT_LABELS[a.type]}</p>
                    <p className="truncate text-soliflex-gray-400">{a.fileName}</p>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Cost entries */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Cost &amp; spare parts</h2>
            {ticket.costEntries.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {ticket.costEntries.map((c) => (
                  <li key={c.id} className="flex justify-between text-soliflex-gray-600">
                    <span>
                      {c.description} {c.sparePartUsed && <span className="text-xs text-soliflex-gray-400">(spare part)</span>}
                    </span>
                    <span className="font-medium">₹{c.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {ticket.actualCost !== null && <p className="mb-3 text-sm font-semibold">Total: ₹{ticket.actualCost.toLocaleString()}</p>}
            {(isMechanic || isManager) && ticket.status !== "CLOSED" && (
              <div className="flex gap-2">
                <input value={costDesc} onChange={(e) => setCostDesc(e.target.value)} placeholder="Description" className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm" />
                <input value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="Amount" type="number" className="w-28 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm" />
                <label className="flex items-center gap-1 whitespace-nowrap text-xs text-soliflex-gray-600">
                  <input type="checkbox" checked={costIsPart} onChange={(e) => setCostIsPart(e.target.checked)} /> Spare part
                </label>
                <button
                  onClick={() =>
                    handleAction(async () => {
                      if (!id || !costDesc || !costAmount) return;
                      await mutations.addCostEntry.mutateAsync({ id, data: { description: costDesc, amount: Number(costAmount), sparePartUsed: costIsPart } });
                      setCostDesc("");
                      setCostAmount("");
                      setCostIsPart(false);
                    })
                  }
                  className="flex items-center gap-1 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-sm font-medium hover:bg-soliflex-gray-200"
                >
                  <IndianRupee className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Activity</h2>
            <ol className="space-y-2 border-l border-soliflex-gray-100 pl-4">
              {ticket.statusHistory.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-soliflex-ink">
                    <span className="font-medium">{h.changedBy.name}</span> moved to <StatusBadge status={h.toStatus} />
                  </p>
                  {h.comment && <p className="text-xs text-soliflex-gray-400">{h.comment}</p>}
                  <p className="text-xs text-soliflex-gray-400">{format(new Date(h.createdAt), "dd MMM yyyy, HH:mm")}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <h2 className="text-sm font-bold text-soliflex-ink">Workflow</h2>

            {ticket.status === "OPEN" && isMechanic && (
              // A mechanic self-assigns directly - no picker needed (and the user list the
              // picker would use is only visible to managers/admins anyway).
              <button
                onClick={() => id && handleAction(() => mutations.acknowledge.mutateAsync({ id }))}
                className="w-full rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
              >
                Acknowledge & assign to myself
              </button>
            )}

            {ticket.status === "OPEN" && isManager && (
              <button onClick={() => setShowAcknowledge(true)} className="w-full rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600">
                Acknowledge & assign
              </button>
            )}

            {ticket.status === "ACKNOWLEDGED" && (isAssignee || isManager) && (
              <button
                onClick={() => id && handleAction(() => mutations.startProgress.mutateAsync(id))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200"
              >
                <PlayCircle className="h-4 w-4" /> Start work
              </button>
            )}

            {ticket.status === "IN_PROGRESS" && (isAssignee || isManager) && (
              <>
                <button onClick={() => setShowChecklist(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Send for verification
                </button>
                <button
                  onClick={() => setShowHold(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <PauseCircle className="h-4 w-4" /> Put on hold
                </button>
              </>
            )}

            {ticket.status === "ON_HOLD" && (isAssignee || isManager) && (
              <button
                onClick={() => id && handleAction(() => mutations.maintResume.mutateAsync(id))}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-50"
              >
                Resume ticket
              </button>
            )}

            {ticket.status === "VERIFICATION_NEEDED" && isProduction && (
              <>
                <button onClick={() => setShowVerify(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  <ShieldCheck className="h-4 w-4" /> Verify &amp; close
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </>
            )}

            {ticket.status === "VERIFICATION_NEEDED" && !isProduction && <p className="text-xs text-soliflex-gray-400">Waiting for the Production team to verify this fix.</p>}

            {ticket.status === "CLOSED" && <p className="text-xs text-soliflex-gray-400">Closed. Maintenance tickets are not reopened.</p>}
          </div>

          <div className="space-y-3 rounded-xl border border-soliflex-gray-100 bg-white p-5 text-sm">
            <h2 className="text-sm font-bold text-soliflex-ink">Details</h2>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Reported by</span>
              <span className="flex items-center gap-1.5">
                <Avatar name={ticket.reportedBy.name} size={20} /> {ticket.reportedBy.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Assignee</span>
              <span>{ticket.assignedTo ? ticket.assignedTo.name : "Unassigned"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Machine</span>
              <span className="text-right">{ticket.machine ? `${ticket.machine.name} (${ticket.machine.itemCode})` : "—"}</span>
            </div>
            {ticket.machine && (ticket.machine.model || ticket.machine.manufacturer || ticket.machine.powerCapacity) && (
              <div className="rounded-lg bg-soliflex-gray-50 px-3 py-2 text-xs text-soliflex-gray-500">
                {ticket.machine.model && <div>Model: {ticket.machine.model}</div>}
                {ticket.machine.manufacturer && <div>Manufacturer: {ticket.machine.manufacturer}</div>}
                {ticket.machine.powerCapacity && <div>Power capacity: {ticket.machine.powerCapacity}</div>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Plant</span>
              <span>{ticket.plant?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Department</span>
              <span>{ticket.department?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Problem type</span>
              <span>{ticket.problemType ? PROBLEM_TYPE_LABELS[ticket.problemType] : "—"}</span>
            </div>
            {isManager && ticket.status !== "CLOSED" ? (
              <div className="flex items-center justify-between">
                <span className="text-soliflex-gray-400">Priority</span>
                <select
                  value={ticket.priority ?? ""}
                  onChange={(e) => id && handleAction(() => mutations.updatePriority.mutateAsync({ id, priority: e.target.value as NonNullable<typeof ticket.priority> }))}
                  className="rounded-md border border-soliflex-gray-200 px-2 py-1 text-xs font-semibold"
                >
                  {!ticket.priority && (
                    <option value="" disabled>
                      Set priority
                    </option>
                  )}
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-soliflex-gray-400">Priority</span>
                <PriorityBadge priority={ticket.priority} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Raised</span>
              <span>{format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm")}</span>
            </div>
          </div>
        </div>
      </div>

      {showAcknowledge && id && <AcknowledgeModal ticketId={id} isManager={isManager} onClose={() => setShowAcknowledge(false)} />}
      {showHold && id && <MaintHoldModal ticketId={id} onClose={() => setShowHold(false)} />}
      {showChecklist && id && <ChecklistModal ticketId={id} onClose={() => setShowChecklist(false)} />}
      {showVerify && id && <VerifyModal ticketId={id} onClose={() => setShowVerify(false)} />}
      {showReject && id && <RejectModal ticketId={id} onClose={() => setShowReject(false)} />}
    </div>
  );
}
