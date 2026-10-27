import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import toast from "react-hot-toast";
import { useWorkstreamStore } from "../../store/workstream.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { allowedWorkstreamsForCreate } from "./permissions";
import { useTickets, useTicketMutations } from "./hooks";
import { STATUS_LABELS, OnHoldBadge, PriorityBadge, MachineStatusBadge, SlaBreachBadge } from "../../components/badges";
import { Avatar } from "../../components/Avatar";
import { Spinner } from "../../components/Spinner";
import type { Ticket, TicketStatus } from "../../lib/types";
import { AssignModal } from "./AssignModal";
import { CloseModal } from "./CloseModal";
import { apiErrorMessage } from "../../lib/api";
import { HelpdeskDiscoveryBanner } from "../helpdesk/HelpdeskDiscoveryBanner";

// Maintenance: read-only board - the many gated steps (pick an assignee to
// acknowledge, complete the 5S checklist, rate quality to verify...) don't fit
// a one-step drag, so cards just link to the ticket detail page.
const MAINTENANCE_COLUMNS: TicketStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "ON_HOLD", "VERIFICATION_NEEDED", "CLOSED"];
// IT keeps drag-and-drop: OPEN -> ASSIGNED -> IN_PROGRESS -> CLOSED.
const IT_COLUMNS: TicketStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "CLOSED"];

const IT_NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  OPEN: "ASSIGNED",
  ASSIGNED: "IN_PROGRESS",
};

function TicketCard({ ticket, draggable }: { ticket: Ticket; draggable: boolean }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id, disabled: !draggable });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className={`mb-2 cursor-pointer space-y-2 rounded-lg border border-soliflex-gray-100 bg-white p-3 shadow-card ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-soliflex-gray-400">{ticket.ticketNumber}</span>
        {ticket.onHold && <OnHoldBadge />}
      </div>
      <p className="text-sm font-medium text-soliflex-ink line-clamp-2">{ticket.displayTitle}</p>
      {ticket.machine && (
        <p className="truncate text-xs text-soliflex-gray-500">
          {ticket.machine.name} ({ticket.machine.itemCode})
        </p>
      )}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={ticket.priority} />
        {ticket.assignedTo && <Avatar name={ticket.assignedTo.name} size={22} />}
      </div>
      {ticket.machineStatus && <MachineStatusBadge status={ticket.machineStatus} />}
      {ticket.slaBreached && <SlaBreachBadge />}
    </div>
  );
}

function Column({ status, tickets, draggable }: { status: TicketStatus; tickets: Ticket[]; draggable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !draggable });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-xl bg-soliflex-gray-100/60 p-2 ${isOver ? "ring-2 ring-soliflex-orange-300" : ""}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wide text-soliflex-gray-500">{STATUS_LABELS[status]}</span>
        <span className="text-xs font-semibold text-soliflex-gray-400">{tickets.length}</span>
      </div>
      <div className="min-h-[60px] flex-1 overflow-y-auto">
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} draggable={draggable} />
        ))}
      </div>
    </div>
  );
}

export default function TicketsBoardPage() {
  const workstream = useWorkstreamStore((s) => s.workstream);
  const isMaintenance = workstream === "MAINTENANCE";
  const user = useAuthStore((s) => s.user);
  const setCreateTicketOpen = useUIStore((s) => s.setCreateTicketOpen);
  const canCreate = user ? allowedWorkstreamsForCreate(user.role).length > 0 : false;
  const { data: tickets = [], isLoading } = useTickets({ workstream });
  const mutations = useTicketMutations();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [assignTarget, setAssignTarget] = useState<Ticket | null>(null);
  const [closeTarget, setCloseTarget] = useState<Ticket | null>(null);

  const columns: TicketStatus[] = isMaintenance ? MAINTENANCE_COLUMNS : IT_COLUMNS;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    if (isMaintenance) return;
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    if (isMaintenance) return;
    const { active, over } = event;
    if (!over) return;
    const ticket = tickets.find((t) => t.id === active.id);
    if (!ticket) return;
    const targetStatus = over.id as TicketStatus;
    if (targetStatus === ticket.status) return;

    const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
    const isAssignee = ticket.assignedToId === user?.id;
    if (targetStatus === "CLOSED") {
      if (ticket.status === "IN_PROGRESS" && !ticket.onHold && (isManager || isAssignee)) {
        setCloseTarget(ticket);
      } else {
        toast.error("Put the ticket back on track first - it is on hold or not yours to close.");
      }
      return;
    }
    if (IT_NEXT_STATUS[ticket.status] !== targetStatus) {
      toast.error("Tickets move one stage at a time — open the ticket for other actions.");
      return;
    }

    try {
      if (targetStatus === "ASSIGNED") {
        setAssignTarget(ticket);
        return;
      }
      if (targetStatus === "IN_PROGRESS") await mutations.startProgress.mutateAsync(ticket.id);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-soliflex-ink">{isMaintenance ? "Maintenance" : "IT"} Board</h1>
        {canCreate && (
          <button
            onClick={() => setCreateTicketOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        )}
      </div>
      <HelpdeskDiscoveryBanner />
      {isMaintenance && <p className="mb-3 text-xs text-soliflex-gray-400">Open a ticket to acknowledge, update or verify it — each step has its own checks.</p>}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((status) => (
            <Column key={status} status={status} tickets={tickets.filter((t) => t.status === status)} draggable={!isMaintenance} />
          ))}
        </div>
        <DragOverlay>{activeTicket && <TicketCard ticket={activeTicket} draggable />}</DragOverlay>
      </DndContext>

      {assignTarget && (user?.role === "MANAGER" || user?.role === "ADMIN") && <AssignModal ticket={assignTarget} onClose={() => setAssignTarget(null)} />}
      {closeTarget && <CloseModal ticket={closeTarget} onClose={() => setCloseTarget(null)} />}
    </div>
  );
}
