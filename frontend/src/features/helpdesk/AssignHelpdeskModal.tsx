import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { fetchUsers } from "../users/api";
import { useHelpdeskMutations } from "./hooks";
import type { HelpdeskTicket, Priority } from "../../lib/types";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function AssignHelpdeskModal({ ticket, onClose }: { ticket: HelpdeskTicket; onClose: () => void }) {
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const engineers = users.filter((u) => u.role === "IT_SUPPORT_ENGINEER" && u.active);
  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
  const [deadline, setDeadline] = useState(ticket.deadline ? ticket.deadline.slice(0, 16) : "");
  const [priority, setPriority] = useState<Priority>(ticket.priority ?? "MEDIUM");
  const { assign } = useHelpdeskMutations(ticket.id);

  return (
    <Modal title={`Assign ${ticket.ticketNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">IT Support Engineer</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="">Select engineer</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Deadline (required)</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() =>
            assign.mutate(
              { id: ticket.id, data: { assignedToId, deadline: new Date(deadline).toISOString(), priority } },
              { onSuccess: onClose }
            )
          }
          disabled={!assignedToId || !deadline || assign.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Assign ticket
        </button>
      </div>
    </Modal>
  );
}
