import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CreateTicketModal } from "../features/tickets/CreateTicketModal";

export function AppShell() {
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
