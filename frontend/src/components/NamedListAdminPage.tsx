import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { apiErrorMessage } from "../lib/api";

export interface NamedItem {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  title: string;
  itemLabel: string; // e.g. "plant" / "department"
  hint: string;
  placeholder: string;
  fetchAll: (all: boolean) => Promise<NamedItem[]>;
  create: (name: string) => Promise<NamedItem>;
  update: (id: string, data: { name?: string; active?: boolean }) => Promise<NamedItem>;
  remove: (id: string) => Promise<void>;
  queryKey: string;
}

/**
 * Shared admin CRUD list for simple named entities (Plants, Departments):
 * create, rename (with a confirm step), activate/deactivate, and delete
 * (blocked server-side while in use; a strong "type the name to confirm"
 * prompt guards against accidental deletes either way).
 */
export function NamedListAdminPage({ title, itemLabel, hint, placeholder, fetchAll, create, update, remove, queryKey }: Props) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: [queryKey, "all"], queryFn: () => fetchAll(true) });
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<NamedItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmingEdit, setConfirmingEdit] = useState(false);
  const [deleting, setDeleting] = useState<NamedItem | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: [queryKey] });
  }

  const createM = useMutation({
    mutationFn: () => create(newName.trim()),
    onSuccess: () => {
      toast.success(`${itemLabel} added`);
      setNewName("");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const updateM = useMutation({
    mutationFn: (data: { name?: string; active?: boolean }) => update(editing!.id, data),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      setConfirmingEdit(false);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteM = useMutation({
    mutationFn: () => remove(deleting!.id),
    onSuccess: () => {
      toast.success(`${itemLabel} deleted`);
      setDeleting(null);
      setDeleteTyped("");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-soliflex-ink">{title}</h1>
      <p className="mb-4 text-sm text-soliflex-gray-500">{hint}</p>

      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm outline-none focus:border-soliflex-orange-500"
        />
        <button
          onClick={() => createM.mutate()}
          disabled={!newName.trim() || createM.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-soliflex-gray-400">Loading…</p>
      ) : (
        <div className="divide-y divide-soliflex-gray-100 rounded-xl border border-soliflex-gray-100 bg-white">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-soliflex-ink">{it.name}</span>
                {!it.active && <span className="rounded-full bg-soliflex-gray-100 px-2 py-0.5 text-xs font-semibold text-soliflex-gray-500">Inactive</span>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateM.mutate({ active: !it.active })}
                  className="rounded-md px-2 py-1 text-xs font-medium text-soliflex-gray-600 hover:bg-soliflex-gray-50"
                  disabled={updateM.isPending}
                >
                  {it.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    setEditing(it);
                    setEditValue(it.name);
                    setConfirmingEdit(false);
                  }}
                  className="rounded-md p-1.5 text-soliflex-gray-500 hover:bg-soliflex-gray-100"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setDeleting(it);
                    setDeleteTyped("");
                  }}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-soliflex-gray-400">None yet. Add one above.</p>}
        </div>
      )}

      {editing && (
        <Modal title={`Edit ${itemLabel}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <input
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                setConfirmingEdit(false);
              }}
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
            />
            {!confirmingEdit ? (
              <button
                onClick={() => setConfirmingEdit(true)}
                disabled={!editValue.trim() || editValue.trim() === editing.name}
                className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
              >
                Save changes
              </button>
            ) : (
              <div className="space-y-2 rounded-lg bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  Rename "{editing.name}" to "{editValue.trim()}"? Existing tickets keep their history either way.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateM.mutate({ name: editValue.trim() })}
                    disabled={updateM.isPending}
                    className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Yes, rename it
                  </button>
                  <button onClick={() => setConfirmingEdit(false)} className="flex-1 rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm font-medium text-soliflex-gray-700">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${itemLabel}`} onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              This permanently deletes <span className="font-semibold">{deleting.name}</span>. This cannot be undone. If it is used by any ticket, deletion will be
              refused — deactivate it instead.
            </div>
            <p className="text-sm text-soliflex-gray-600">
              Type <span className="font-mono font-semibold">{deleting.name}</span> to confirm.
            </p>
            <input
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
              autoFocus
            />
            <button
              onClick={() => deleteM.mutate()}
              disabled={deleteTyped !== deleting.name || deleteM.isPending}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
