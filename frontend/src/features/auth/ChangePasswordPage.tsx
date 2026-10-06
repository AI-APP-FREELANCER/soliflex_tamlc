import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/auth.store";
import type { User } from "../../lib/types";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const forced = !!user?.mustResetPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      // Pick up the cleared "must reset" flag so the app unlocks.
      const me = await api.get<User>("/auth/me");
      const token = useAuthStore.getState().accessToken;
      if (token) useAuthStore.getState().setSession(token, me.data);
      toast.success("Password updated");
      navigate("/");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-bold text-soliflex-ink">{forced ? "Set a new password" : "Change password"}</h1>
      {forced && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You are signed in with a temporary password. Please choose your own password to continue.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-soliflex-gray-100 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">{forced ? "Temporary password" : "Current password"}</label>
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">New password</label>
          <input type="password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-soliflex-gray-400">At least 10 characters with upper and lower case letters, a number and a symbol.</p>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50">
          Update password
        </button>
      </form>
    </div>
  );
}
