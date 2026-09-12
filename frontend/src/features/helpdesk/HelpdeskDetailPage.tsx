import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useHelpdeskTicket, useHelpdeskMutations } from "./hooks";
import { HelpdeskStatusBadge, HELPDESK_CATEGORY_LABELS, DeadlineBreachedBadge, OnHoldBadge } from "./badges";
import { PriorityBadge } from "../../components/badges";
import { AssignHelpdeskModal } from "./AssignHelpdeskModal";
import { Avatar } from "../../components/Avatar";
import { Spinner } from "../../components/Spinner";
import { formatIST } from "../../lib/formatIST";
import * as perms from "./permissions";

export default function HelpdeskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: ticket, isLoading } = useHelpdeskTicket(id);
  const mutations = useHelpdeskMutations(id);
  const [comment, setComment] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  if (isLoading || !ticket) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-soliflex-gray-500 hover:text-soliflex-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-lg font-bold text-soliflex-ink">
            {ticket.ticketNumber} · {ticket.title}
          </h1>
          <HelpdeskStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.onHold && <OnHoldBadge />}
          {ticket.deadlineBreached && <DeadlineBreachedBadge />}
        </div>
        <p className="mb-4 text-sm text-soliflex-gray-600">{ticket.description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-soliflex-gray-400">Category</p>
            <p className="font-medium text-soliflex-ink">{HELPDESK_CATEGORY_LABELS[ticket.category]}</p>
          </div>
          <div>
            <p className="text-xs text-soliflex-gray-400">Raised by</p>
            <p className="font-medium text-soliflex-ink">{ticket.raisedBy?.name}</p>
          </div>
          <div>
            <p className="text-xs text-soliflex-gray-400">Assigned to</p>
            <p className="font-medium text-soliflex-ink">{ticket.assignedTo?.name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-soliflex-gray-400">Team lead</p>
            <p className="font-medium text-soliflex-ink">{ticket.teamLead?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-soliflex-gray-400">Deadline</p>
            <p className={`font-medium ${ticket.deadlineBreached ? "text-red-600" : "text-soliflex-ink"}`}>
              {ticket.deadline ? formatIST(ticket.deadline) : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-soliflex-gray-400">Raised on</p>
            <p className="font-medium text-soliflex-ink">{formatIST(ticket.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-soliflex-gray-100 pt-4">
          {perms.canAssign(user.role) && (ticket.status === "OPEN" || ticket.status === "ASSIGNED" || ticket.status === "REOPENED") && (
            <button onClick={() => setAssignOpen(true)} className="rounded-lg bg-soliflex-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-soliflex-orange-600">
              {ticket.assignedTo ? "Reassign" : "Assign"}
            </button>
          )}
          {perms.canStartProgress(ticket, user) && (
            <button onClick={() => mutations.startProgress.mutate(ticket.id)} className="rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200">
              Start progress
            </button>
          )}
          {perms.canHoldOrResume(ticket, user) &&
            (ticket.onHold ? (
              <button onClick={() => mutations.resume.mutate(ticket.id)} className="rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200">
                Resume
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Hold reason"
                  className="rounded-lg border border-soliflex-gray-200 px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => holdReason && mutations.hold.mutate({ id: ticket.id, detail: holdReason }, { onSuccess: () => setHoldReason("") })}
                  disabled={!holdReason}
                  className="rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-xs font-semibold hover:bg-soliflex-gray-200 disabled:opacity-50"
                >
                  Put on hold
                </button>
              </div>
            ))}
          {perms.canResolve(ticket, user) && (
            <button onClick={() => mutations.resolve.mutate({ id: ticket.id })} className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600">
              Mark resolved
            </button>
          )}
          {perms.canClose(ticket, user) && (
            <button onClick={() => mutations.close.mutate(ticket.id)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
              Close ticket
            </button>
          )}
          {perms.canReopen(ticket, user) && (
            <div className="flex items-center gap-1">
              <input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason to reopen"
                className="rounded-lg border border-soliflex-gray-200 px-2 py-1.5 text-xs"
              />
              <button
                onClick={() => reopenReason && mutations.reopen.mutate({ id: ticket.id, reason: reopenReason }, { onSuccess: () => setReopenReason("") })}
                disabled={!reopenReason}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Reopen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Status history</h2>
        <ul className="space-y-2 text-xs text-soliflex-gray-500">
          {ticket.statusHistory.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              <span className="font-medium text-soliflex-ink">{h.toStatus}</span>
              <span>by {h.changedBy.name}</span>
              <span>· {formatIST(h.createdAt)}</span>
              {h.comment && <span className="text-soliflex-gray-400">— {h.comment}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-soliflex-ink">Comments &amp; follow-ups</h2>
        <div className="space-y-3">
          {ticket.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.author.name} size={26} />
              <div>
                <p className="text-sm">
                  <span className="font-semibold text-soliflex-ink">{c.author.name}</span>{" "}
                  <span className="text-xs text-soliflex-gray-400">{formatIST(c.createdAt)}</span>
                </p>
                <p className="text-sm text-soliflex-gray-600">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment or follow-up..."
            className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => comment && mutations.addComment.mutate({ id: ticket.id, body: comment }, { onSuccess: () => setComment("") })}
            disabled={!comment}
            className="rounded-lg bg-soliflex-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {assignOpen && <AssignHelpdeskModal ticket={ticket} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}
