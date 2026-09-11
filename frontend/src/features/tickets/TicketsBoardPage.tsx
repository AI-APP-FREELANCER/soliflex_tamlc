import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import toast from "react-hot-toast";
import { useWorkstreamStore } from "../../store/workstream.store";
import { useAuthStore } from "../../store/auth.store";
import { useTickets, useTicketMutations } from "./hooks";
import { STATUS_LABELS, OnHoldBadge, PriorityBadge, SlaBreachBadge } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { Spinner } from "../../components/Spinner";
import type { Ticket, TicketStatus } from "../../lib/types";
import { AssignModal } from "./AssignModal";
import { CloseModal } from "./CloseModal";
import { apiErrorMessage } from "../../lib/api";

const COLUMNS: TicketStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "FIRST_LINE_REVIEW", "JOB_COMPLETED", "FINAL_REVIEW", "CLOSED"];

const NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  OPEN: "ASSIGNED",
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "FIRST_LINE_REVIEW",
  FIRST_LINE_REVIEW: "JOB_COMPLETED",
  JOB_COMPLETED: "FINAL_REVIEW",
  FINAL_REVIEW: "CLOSED",
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className={`mb-2 cursor-grab space-y-2 rounded-lg border border-soliflex-gray-100 bg-white p-3 shadow-card active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-soliflex-gray-400">{ticket.ticketNumber}</span>
        {ticket.onHold && <OnHoldBadge />}
      </div>
      <p className="text-sm font-medium text-soliflex-ink line-clamp-2">{ticket.title}</p>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={ticket.priority} />
        {ticket.assignedTo && <Avatar name={ticket.assignedTo.name} size={22} />}
      </div>
      {ticket.slaBreached && <SlaBreachBadge />}
    </div>
  );
}

function Column({ status, tickets }: { status: TicketStatus; tickets: Ticket[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-xl bg-soliflex-gray-100/60 p-2 ${isOver ? "ring-2 ring-soliflex-orange-300" : ""}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wide text-soliflex-gray-500">{STATUS_LABELS[status]}</span>
        <span className="text-xs font-semibold text-soliflex-gray-400">{tickets.length}</span>
      </div>
      <div className="min-h-[60px] flex-1 overflow-y-auto">
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
      </div>
    </div>
  );
}

export default function TicketsBoardPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const user = useAuthStore((s) => s.user);
  const { data: tickets = [], isLoading } = useTickets({ workstream });
  const mutations = useTicketMutations();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [assignTarget, setAssignTarget] = useState<Ticket | null>(null);
  const [closeTarget, setCloseTarget] = useState<Ticket | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;
    const ticket = tickets.find((t) => t.id === active.id);
    if (!ticket) return;
    const targetStatus = over.id as TicketStatus;
    if (targetStatus === ticket.status) return;

    if (NEXT_STATUS[ticket.status] !== targetStatus) {
      toast.error("Tickets move one stage at a time — open the ticket for other actions.");
      return;
    }

    try {
      if (targetStatus === "ASSIGNED") {
        setAssignTarget(ticket);
        return;
      }
      if (targetStatus === "CLOSED") {
        setCloseTarget(ticket);
        return;
      }
      if (targetStatus === "IN_PROGRESS") await mutations.startProgress.mutateAsync(ticket.id);
      if (targetStatus === "FIRST_LINE_REVIEW") await mutations.markFirstLineReview.mutateAsync(ticket.id);
      if (targetStatus === "JOB_COMPLETED") await mutations.markJobCompleted.mutateAsync(ticket.id);
      if (targetStatus === "FINAL_REVIEW") await mutations.markFinalReview.mutateAsync(ticket.id);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-soliflex-ink">{workstream === "MAINTENANCE" ? "Maintenance" : "IT"} Board</h1>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} tickets={tickets.filter((t) => t.status === status)} />
          ))}
        </div>
        <DragOverlay>{activeTicket && <TicketCard ticket={activeTicket} />}</DragOverlay>
      </DndContext>

      {assignTarget && (user?.role === "MANAGER" || user?.role === "ADMIN") && <AssignModal ticket={assignTarget} onClose={() => setAssignTarget(null)} />}
      {closeTarget && (user?.role === "MANAGER" || user?.role === "ADMIN") && <CloseModal ticket={closeTarget} onClose={() => setCloseTarget(null)} />}
    </div>
  );
}
