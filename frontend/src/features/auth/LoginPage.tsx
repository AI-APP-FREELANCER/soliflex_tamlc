import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import clsx from "clsx";
import { API_BASE_URL, apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/auth.store";
import { Loader2 } from "lucide-react";

type LoginTab = "employee" | "staff";

export default function LoginPage() {
  const [tab, setTab] = useState<LoginTab>("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      );
      setSession(res.data.accessToken, res.data.user);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-soliflex-orange-500 via-soliflex-orange-600 to-soliflex-brick-600 p-12 text-white lg:flex">
        <img src="/soliflex-logo.png" alt="Soliflex" className="h-12 w-fit rounded-lg bg-white/90 p-2" />
        <div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight">
            Ticketing &amp; Asset
            <br />
            Management
          </h1>
          <p className="max-w-md text-lg text-white/90">
            Track maintenance and IT tickets, manage asset lifecycles, and keep every job accountable — from raise to
            close.
          </p>
        </div>
        <p className="text-sm text-white/70">Grow with certainty.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">
          <img src="/soliflex-logo.png" alt="Soliflex" className="mb-8 h-9 lg:hidden" />
          <h2 className="text-2xl font-bold text-soliflex-ink">Sign in</h2>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-soliflex-gray-100 p-1">
            <button
              type="button"
              onClick={() => setTab("employee")}
              className={clsx(
                "rounded-md py-2 text-xs font-semibold transition",
                tab === "employee" ? "bg-white text-soliflex-orange-600 shadow-sm" : "text-soliflex-gray-500"
              )}
            >
              Employee — Raise an IT issue
            </button>
            <button
              type="button"
              onClick={() => setTab("staff")}
              className={clsx(
                "rounded-md py-2 text-xs font-semibold transition",
                tab === "staff" ? "bg-white text-soliflex-orange-600 shadow-sm" : "text-soliflex-gray-500"
              )}
            >
              IT Support / Maintenance Staff
            </button>
          </div>

          <p className="mt-3 text-sm text-soliflex-gray-500">
            {tab === "employee"
              ? "Sign in to submit and track your own IT support requests."
              : "For IT Support Engineers, Team Leads, Mechanics, Managers, and Admins."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                placeholder="you@soliflex.local"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-soliflex-orange-600 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          {tab === "employee" ? (
            <p className="mt-6 text-xs text-soliflex-gray-400">
              New here?{" "}
              <Link to="/register" className="font-semibold text-soliflex-orange-600 hover:underline">
                Create your account
              </Link>{" "}
              with your company email.
            </p>
          ) : (
            <p className="mt-6 text-xs text-soliflex-gray-400">
              No self sign-up for staff roles — accounts are created and managed by your Admin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
