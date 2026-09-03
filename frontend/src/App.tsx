import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import LoginPage from "./features/auth/LoginPage";
import ChangePasswordPage from "./features/auth/ChangePasswordPage";
import TicketsBoardPage from "./features/tickets/TicketsBoardPage";
import TicketsListPage from "./features/tickets/TicketsListPage";
import TicketDetailPage from "./features/tickets/TicketDetailPage";
import AssetsPage from "./features/assets/AssetsPage";
import AssetDetailPage from "./features/assets/AssetDetailPage";
import UsersPage from "./features/users/UsersPage";
import DashboardPage from "./features/reports/DashboardPage";
import AuditLogPage from "./features/audit/AuditLogPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<TicketsBoardPage />} />
          <Route path="/tickets" element={<TicketsListPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/:type/:id" element={<AssetDetailPage />} />
          <Route path="/reports" element={<DashboardPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<ProtectedRoute roles={["MANAGER"]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["MANAGER", "ADMIN"]} />}>
            <Route path="/audit" element={<AuditLogPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
