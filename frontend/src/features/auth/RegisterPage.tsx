import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/auth.store";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/register`,
        { employeeId, name, email, phone: phone || undefined, password },
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
            IT Helpdesk
            <br />
            for Employees
          </h1>
          <p className="max-w-md text-lg text-white/90">
            Raise laptop, printer, network, or software issues and track them through to resolution — right from your
            company account.
          </p>
        </div>
        <p className="text-sm text-white/70">Grow with certainty.</p>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-white px-6 py-10">
        <div className="w-full max-w-sm">
          <img src="/soliflex-logo.png" alt="Soliflex" className="mb-8 h-9 lg:hidden" />
          <h2 className="text-2xl font-bold text-soliflex-ink">Create your account</h2>
          <p className="mt-1 text-sm text-soliflex-gray-500">
            For employees raising IT support requests. Use your company email —
            <span className="font-medium"> @soliflexpackaging.com</span> or <span className="font-medium">@indautogroup.com</span>.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Employee ID</label>
                <input
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                  placeholder="EMP-1234"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Full name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                  placeholder="Jane Doe"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Company email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                placeholder="you@soliflexpackaging.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Phone (optional)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                placeholder="9876543210"
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
                placeholder="••••••••••"
              />
              <p className="mt-1 text-xs text-soliflex-gray-400">
                At least 10 characters, with an uppercase letter, lowercase letter, number, and symbol.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soliflex-orange-500 focus:ring-2 focus:ring-soliflex-orange-100"
                placeholder="••••••••••"
              />
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-soliflex-orange-600 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </button>
          </form>

          <p className="mt-6 text-xs text-soliflex-gray-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-soliflex-orange-600 hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-xs text-soliflex-gray-400">
            IT Support Engineer, Team Lead, or Admin? Ask your Admin for an account — those roles aren't self-service.
          </p>
        </div>
      </div>
    </div>
  );
}
