import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, KeyRound, ChevronDown, Search, Menu } from "lucide-react";
import { useAuthStore } from "../store/auth.store";
import { useUIStore } from "../store/ui.store";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";
import { NotificationsBell } from "../features/notifications/NotificationsBell";

const LEGACY_TICKET_ROLES = new Set(["MANAGER", "MECHANIC", "IT_TEAM", "PRODUCTION", "ADMIN"]);

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setCreateTicketOpen = useUIStore((s) => s.setCreateTicketOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const canCreateLegacyTicket = user ? LEGACY_TICKET_ROLES.has(user.role) : false;

  async function handleLogout() {
    await api.post("/auth/logout");
    clearSession();
    navigate("/login");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-soliflex-gray-100 bg-white px-3 sm:px-5">
      <button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-soliflex-gray-500 hover:bg-soliflex-gray-100 md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-sm text-soliflex-gray-500 sm:flex">
        <Search className="h-4 w-4" />
        <span>Search tickets, assets...</span>
      </div>
      <button className="rounded-lg p-2 text-soliflex-gray-500 hover:bg-soliflex-gray-100 sm:hidden">
        <Search className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
        {canCreateLegacyTicket && (
          <button
            onClick={() => setCreateTicketOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-soliflex-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create</span>
          </button>
        )}
        <NotificationsBell />
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-soliflex-gray-100">
            <Avatar name={user?.name ?? "?"} />
            <ChevronDown className="h-4 w-4 text-soliflex-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-soliflex-gray-100 bg-white p-1 shadow-popover">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-soliflex-ink">{user?.name}</p>
                <p className="text-xs text-soliflex-gray-400">{user?.role} · {user?.workstream ?? "All"}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/change-password");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-soliflex-gray-600 hover:bg-soliflex-gray-100"
              >
                <KeyRound className="h-4 w-4" /> Change password
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
