import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, Paperclip, IndianRupee, PlayCircle, CheckCircle2, PauseCircle, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTicket, useTicketMutations } from "./hooks";
import { useAuthStore } from "../../store/auth.store";
import { Spinner } from "../../components/Spinner";
import { StatusBadge, PriorityBadge, OnHoldBadge, SlaBreachBadge } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { AssignModal } from "./AssignModal";
import { CloseModal } from "./CloseModal";
import { HoldModal } from "./HoldModal";
import { RecommendationModal } from "./RecommendationModal";
import { API_BASE_URL, apiErrorMessage } from "../../lib/api";
import type { AttachmentType } from "../../lib/types";

const ATTACHMENT_LABELS: Record<AttachmentType, string> = {
  PRE_FIX_PHOTO: "Pre-fix photo",
  POST_FIX_PHOTO: "Post-fix photo",
  INVOICE: "Invoice",
  OTHER: "Other",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, isLoading } = useTicket(id);
  const mutations = useTicketMutations(id);

  const [comment, setComment] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<AttachmentType>("PRE_FIX_PHOTO");

  if (isLoading || !ticket) return <Spinner />;

  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const isAssignee = ticket.assignedToId === user?.id;
  const isTechnician = user?.role === "MECHANIC" || user?.role === "IT_TEAM";

  async function handleAction(fn: () => Promise<any>) {
    try {
      await fn();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !id) return;
    for (const file of Array.from(files)) {
      await mutations.addAttachment.mutateAsync({ id, file, type: pendingUploadType });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-soliflex-gray-500 hover:text-soliflex-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-soliflex-gray-400">{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.onHold && <OnHoldBadge />}
              {ticket.slaBreached && <SlaBreachBadge />}
            </div>
            <h1 className="text-lg font-bold text-soliflex-ink">{ticket.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-soliflex-gray-600">{ticket.description}</p>
            {ticket.plantLocation && <p className="mt-3 text-xs text-soliflex-gray-400">Location: {ticket.plantLocation}</p>}

            {ticket.onHold && (
              <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                On hold — {ticket.onHoldReason?.replace("_", " ")}: {ticket.onHoldDetail}
              </div>
            )}

            {(ticket.diagnosis || ticket.recommendedFix) && (
              <div className="mt-4 space-y-2 rounded-lg border border-soliflex-gray-100 bg-soliflex-gray-50 p-3 text-sm">
                {ticket.diagnosis && (
                  <p>
                    <span className="font-semibold">Diagnosis: </span>
                    {ticket.diagnosis}
                  </p>
                )}
                {ticket.recommendedFix && (
                  <p>
                    <span className="font-semibold">Recommended fix: </span>
                    {ticket.recommendedFix}
                  </p>
                )}
                {ticket.approvedAt && (
                  <p className="text-xs text-green-700">Approved by {ticket.approvedBy?.name} on {format(new Date(ticket.approvedAt), "dd MMM yyyy")}</p>
                )}
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
            {(isTechnician || isManager) && (
              <div className="flex gap-2">
                <input value={costDesc} onChange={(e) => setCostDesc(e.target.value)} placeholder="Description" className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm" />
                <input value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="Amount" type="number" className="w-28 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm" />
                <button
                  onClick={() =>
                    handleAction(async () => {
                      if (!id || !costDesc || !costAmount) return;
                      await mutations.addCostEntry.mutateAsync({ id, data: { description: costDesc, amount: Number(costAmount) } });
                      setCostDesc("");
                      setCostAmount("");
                    })
                  }
                  className="flex items-center gap-1 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-sm font-medium hover:bg-soliflex-gray-200"
                >
                  <IndianRupee className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Comments</h2>
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
              {ticket.comments.length === 0 && <p className="text-sm text-soliflex-gray-400">No comments yet.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment"
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
                className="rounded-lg bg-soliflex-orange-500 px-3 py-2 text-white hover:bg-soliflex-orange-600"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
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
            <h2 className="text-sm font-bold text-soliflex-ink">Actions</h2>

            {isManager && ticket.status === "OPEN" && (
              <button onClick={() => setShowAssign(true)} className="w-full rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600">
                Assign technician
              </button>
            )}

            {isAssignee && ticket.status === "ASSIGNED" && (
              <button
                onClick={() => id && handleAction(() => mutations.startProgress.mutateAsync(id))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200"
              >
                <PlayCircle className="h-4 w-4" /> Start work
              </button>
            )}

            {isAssignee && ticket.status === "IN_PROGRESS" && !ticket.onHold && (
              <button onClick={() => setShowRecommendation(true)} className="w-full rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200">
                Submit diagnosis &amp; fix
              </button>
            )}

            {isManager && ticket.onHold && ticket.onHoldReason === "APPROVAL" && ticket.status === "IN_PROGRESS" && (
              <div className="space-y-2">
                <button
                  onClick={() => id && handleAction(() => mutations.decideRecommendation.mutateAsync({ id, data: { approve: true } }))}
                  className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Approve recommendation
                </button>
                <button
                  onClick={() => id && handleAction(() => mutations.decideRecommendation.mutateAsync({ id, data: { approve: false } }))}
                  className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Reject recommendation
                </button>
              </div>
            )}

            {isAssignee && ticket.status === "IN_PROGRESS" && !ticket.onHold && ticket.approvedAt && (
              <button
                onClick={() => id && handleAction(() => mutations.markFirstLineReview.mutateAsync(id))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200"
              >
                <CheckCircle2 className="h-4 w-4" /> Submit for 1st line review
              </button>
            )}

            {(isManager || isAssignee) && ticket.status === "FIRST_LINE_REVIEW" && (
              <button
                onClick={() => id && handleAction(() => mutations.markJobCompleted.mutateAsync(id))}
                className="w-full rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200"
              >
                Mark job completed
              </button>
            )}

            {isManager && ticket.status === "JOB_COMPLETED" && (
              <button
                onClick={() => id && handleAction(() => mutations.markFinalReview.mutateAsync(id))}
                className="w-full rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-200"
              >
                Send to final review
              </button>
            )}

            {isManager && ticket.status === "FINAL_REVIEW" && (
              <button onClick={() => setShowClose(true)} className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Verify &amp; close
              </button>
            )}

            {ticket.status !== "CLOSED" && !ticket.onHold && (isManager || isAssignee) && (
              <button
                onClick={() => setShowHold(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                <PauseCircle className="h-4 w-4" /> Put on hold
              </button>
            )}

            {ticket.onHold && ticket.onHoldReason !== "APPROVAL" && (isManager || isAssignee) && (
              <button
                onClick={() => id && handleAction(() => mutations.resume.mutateAsync(id))}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm font-semibold hover:bg-soliflex-gray-50"
              >
                Resume ticket
              </button>
            )}
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
              <span className="text-soliflex-gray-400">Manager</span>
              <span>{ticket.manager ? ticket.manager.name : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Category</span>
              <span>{ticket.category.replace("_", " ")}</span>
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
            {ticket.effortEstimateHours && (
              <div className="flex items-center justify-between">
                <span className="text-soliflex-gray-400">Effort estimate</span>
                <span>{ticket.effortEstimateHours}h</span>
              </div>
            )}
            {ticket.targetCompletionDate && (
              <div className="flex items-center justify-between">
                <span className="text-soliflex-gray-400">Target completion</span>
                <span>{format(new Date(ticket.targetCompletionDate), "dd MMM yyyy")}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-soliflex-gray-400">Raised</span>
              <span>{format(new Date(ticket.createdAt), "dd MMM yyyy")}</span>
            </div>
          </div>
        </div>
      </div>

      {showAssign && <AssignModal ticket={ticket} onClose={() => setShowAssign(false)} />}
      {showClose && <CloseModal ticket={ticket} onClose={() => setShowClose(false)} />}
      {showHold && <HoldModal ticket={ticket} onClose={() => setShowHold(false)} />}
      {showRecommendation && <RecommendationModal ticket={ticket} onClose={() => setShowRecommendation(false)} />}
    </div>
  );
}
