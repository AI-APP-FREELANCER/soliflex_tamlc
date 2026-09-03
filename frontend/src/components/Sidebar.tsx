import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { LayoutGrid, List, Boxes, BarChart3, Users, Wrench, Laptop, ScrollText, X } from "lucide-react";
import { useAuthStore } from "../store/auth.store";
import { useWorkstreamStore } from "../store/workstream.store";
import { useUIStore } from "../store/ui.store";

const navItem =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-soliflex-gray-600 hover:bg-soliflex-gray-100 hover:text-soliflex-ink";
const navItemActive = "bg-soliflex-orange-50 text-soliflex-orange-700 hover:bg-soliflex-orange-50 hover:text-soliflex-orange-700";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { workstream, setWorkstream } = useWorkstreamStore();
  const canSeeBoth = user?.role === "MANAGER";
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  return (
    <>
      {mobileMenuOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex h-full w-60 shrink-0 flex-col border-r border-soliflex-gray-100 bg-white transition-transform md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <img src="/soliflex-logo.png" alt="Soliflex" className="h-7" />
        <button onClick={() => setMobileMenuOpen(false)} className="rounded-md p-1 text-soliflex-gray-400 hover:bg-soliflex-gray-100 md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      {(canSeeBoth || true) && (
        <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-lg bg-soliflex-gray-100 p-1">
          <button
            onClick={() => setWorkstream("MAINTENANCE")}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold",
              workstream === "MAINTENANCE" ? "bg-white text-soliflex-orange-600 shadow-sm" : "text-soliflex-gray-500"
            )}
          >
            <Wrench className="h-3.5 w-3.5" /> Maintenance
          </button>
          <button
            onClick={() => setWorkstream("IT")}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold",
              workstream === "IT" ? "bg-white text-soliflex-orange-600 shadow-sm" : "text-soliflex-gray-500"
            )}
          >
            <Laptop className="h-3.5 w-3.5" /> IT
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3">
        <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
          <LayoutGrid className="h-4 w-4" /> Board
        </NavLink>
        <NavLink to="/tickets" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
          <List className="h-4 w-4" /> All Tickets
        </NavLink>
        <NavLink to="/assets" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
          <Boxes className="h-4 w-4" /> Assets
        </NavLink>
        <NavLink to="/reports" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
          <BarChart3 className="h-4 w-4" /> Reports
        </NavLink>
        {user?.role === "MANAGER" && (
          <NavLink to="/users" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
            <Users className="h-4 w-4" /> Users
          </NavLink>
        )}
        {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
          <NavLink to="/audit" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
            <ScrollText className="h-4 w-4" /> Audit Log
          </NavLink>
        )}
      </nav>

      <div className="border-t border-soliflex-gray-100 p-3 text-xs text-soliflex-gray-400">Grow with certainty.</div>
      </aside>
    </>
  );
}
