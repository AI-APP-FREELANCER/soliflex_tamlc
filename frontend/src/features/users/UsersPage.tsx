import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, KeyRound, Pencil, UploadCloud } from "lucide-react";
import { fetchUsers, createUser, updateUser, resetPassword, CreateUserInput } from "./api";
import { Modal } from "../../components/Modal";
import { Avatar } from "../../components/Avatar";
import { Spinner } from "../../components/Spinner";
import { apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/auth.store";
import { BulkImportUsersModal } from "./BulkImportUsersModal";
import type { Role, User, Workstream } from "../../lib/types";

const ALL_ROLES: Role[] = ["MANAGER", "MECHANIC", "IT_TEAM", "PRODUCTION", "ADMIN", "EMPLOYEE", "IT_SUPPORT_ENGINEER", "IT_TEAM_LEAD"];
const ADMIN_ONLY_ROLES = new Set<Role>(["ADMIN", "IT_TEAM_LEAD", "IT_SUPPORT_ENGINEER"]);

/** Mirrors the server-side restriction in users.routes.ts — a convenience only, the server is the real boundary. */
function assignableRoles(actorRole: Role | undefined): Role[] {
  if (actorRole === "ADMIN") return ALL_ROLES;
  return ALL_ROLES.filter((r) => !ADMIN_ONLY_ROLES.has(r));
}

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => updateUser(vars.id, { active: vars.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => resetPassword(id),
    onSuccess: (res) => toast.success(`Temp password: ${res.tempPassword}`, { duration: 10000 }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-soliflex-ink">Users</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkImportOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-100 px-3 py-2 text-sm font-semibold text-soliflex-gray-700 hover:bg-soliflex-gray-200">
            <UploadCloud className="h-4 w-4" /> Bulk upload
          </button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600">
            <Plus className="h-4 w-4" /> New user
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-soliflex-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-soliflex-gray-50 text-left text-xs font-semibold uppercase text-soliflex-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Workstream</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-soliflex-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} size={26} />
                    <div>
                      <p className="font-medium text-soliflex-ink">{u.name}</p>
                      <p className="text-xs text-soliflex-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">{u.workstream ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.active ? "bg-green-50 text-green-700" : "bg-soliflex-gray-100 text-soliflex-gray-500"}`}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditUser(u)} className="flex items-center gap-1 text-xs font-medium text-soliflex-gray-500 hover:underline">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })} className="text-xs font-medium text-soliflex-gray-500 hover:underline">
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => resetPasswordMutation.mutate(u.id)} className="flex items-center gap-1 text-xs font-medium text-soliflex-orange-600 hover:underline">
                      <KeyRound className="h-3 w-3" /> Reset password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {bulkImportOpen && <BulkImportUsersModal onClose={() => setBulkImportOpen(false)} />}
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const actor = useAuthStore((s) => s.user);
  const roles = assignableRoles(actor?.role);
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    workstream: user.workstream,
    department: user.department ?? "",
    phone: user.phone ?? "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => updateUser(user.id, { ...form, department: form.department || undefined, phone: form.phone || undefined }),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-soliflex-gray-400">
          Employee ID and email are fixed identifiers and can't be changed here.
        </p>
        <input placeholder="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.role} onChange={(e) => set("role", e.target.value as Role)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={form.workstream ?? ""} onChange={(e) => set("workstream", (e.target.value || null) as Workstream | null)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="">No workstream</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="IT">IT</option>
          </select>
        </div>
        <input placeholder="Department" value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <input placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </Modal>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const actor = useAuthStore((s) => s.user);
  const roles = assignableRoles(actor?.role);
  const [form, setForm] = useState<CreateUserInput>({ employeeId: "", name: "", email: "", role: "MECHANIC", workstream: "MAINTENANCE", department: "" });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (res) => {
      toast.success(`User created. Temp password: ${res.tempPassword}`, { duration: 10000 });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof CreateUserInput>(key: K, value: CreateUserInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Create user" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Employee ID" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <input placeholder="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.role} onChange={(e) => set("role", e.target.value as Role)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={form.workstream ?? ""} onChange={(e) => set("workstream", (e.target.value || null) as Workstream | null)} className="rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm">
            <option value="">No workstream</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="IT">IT</option>
          </select>
        </div>
        <input placeholder="Department" value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        <button
          onClick={() => mutation.mutate(form)}
          disabled={!form.employeeId || !form.name || !form.email || mutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Create user
        </button>
        <p className="text-xs text-soliflex-gray-400">A temporary password will be generated — share it with the user securely.</p>
      </div>
    </Modal>
  );
}
