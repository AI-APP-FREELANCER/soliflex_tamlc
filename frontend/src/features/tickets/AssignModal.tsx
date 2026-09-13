import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { fetchUsers } from "../users/api";
import { useTicketMutations } from "./hooks";
import type { Priority, Ticket } from "../../lib/types";

export function AssignModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const isEdit = ticket.status !== "OPEN";
  const { data: users = [] } = useQuery({ queryKey: ["users", ticket.workstream], queryFn: () => fetchUsers(ticket.workstream) });
  const assignable = users.filter((u) => u.active && (u.role === "MECHANIC" || u.role === "IT_TEAM"));

  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
  const [priority, setPriority] = useState<Priority>(ticket.priority ?? "MEDIUM");
  const [targetCompletionDate, setTargetCompletionDate] = useState(ticket.targetCompletionDate ? ticket.targetCompletionDate.slice(0, 10) : "");
  const [effortEstimateHours, setEffortEstimateHours] = useState(ticket.effortEstimateHours ? String(ticket.effortEstimateHours) : "");

  const { assign, updateAssignment } = useTicketMutations(ticket.id);
  const pending = isEdit ? updateAssignment.isPending : assign.isPending;

  async function handleSubmit() {
    if (isEdit) {
      await updateAssignment.mutateAsync({
        id: ticket.id,
        data: {
          assignedToId: assignedToId || undefined,
          targetCompletionDate: targetCompletionDate || null,
          effortEstimateHours: effortEstimateHours ? Number(effortEstimateHours) : undefined,
        },
      });
    } else {
      await assign.mutateAsync({
        id: ticket.id,
        data: {
          assignedToId,
          priority,
          targetCompletionDate: targetCompletionDate || undefined,
          effortEstimateHours: effortEstimateHours ? Number(effortEstimateHours) : undefined,
        },
      });
    }
    onClose();
  }

  return (
    <Modal title={isEdit ? `Edit assignment — ${ticket.ticketNumber}` : `Assign ${ticket.ticketNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Assignee</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="" disabled={!isEdit}>
              Select technician
            </option>
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "MECHANIC" ? "Mechanic" : "IT Team"})
              </option>
            ))}
          </select>
          {isEdit && assignable.length === 0 && (
            <p className="mt-1 text-xs text-soliflex-gray-400">
              No active Mechanic/IT Team users found for this workstream — check their role and workstream under Users.
            </p>
          )}
        </div>
        {!isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Target completion</label>
            <input type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Effort est. (hrs)</label>
            <input type="number" min={0} value={effortEstimateHours} onChange={(e) => setEffortEstimateHours(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={(!isEdit && !assignedToId) || pending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          {isEdit ? "Save changes" : "Assign ticket"}
        </button>
      </div>
    </Modal>
  );
}
