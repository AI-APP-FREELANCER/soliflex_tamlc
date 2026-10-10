import { useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useWorkstreamStore } from "../store/workstream.store";
import { workstreamScopeFor } from "../features/tickets/permissions";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CreateTicketModal } from "../features/tickets/CreateTicketModal";

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const setWorkstream = useWorkstreamStore((s) => s.setWorkstream);
  // Open on the user's own workstream (IT staff must not land on Maintenance, and vice versa).
  useLayoutEffect(() => {
    const scope = user ? workstreamScopeFor(user) : null;
    if (scope) setWorkstream(scope);
  }, [user?.id, user?.role, user?.workstream, setWorkstream]);

  return (
    <div className="flex h-screen overflow-hidden bg-soliflex-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
      <CreateTicketModal />
    </div>
  );
}
