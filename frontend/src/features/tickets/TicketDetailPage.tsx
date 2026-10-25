import { useParams } from "react-router-dom";
import { useTicket } from "./hooks";
import { Spinner } from "../../components/Spinner";
import ITTicketDetailPage from "./ITTicketDetailPage";
import MaintenanceTicketDetailPage from "./MaintenanceTicketDetailPage";

/** Maintenance and IT tickets now have fully separate workflows (Oct 2026 redesign) - this just routes to the right one. */
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicket(id);

  if (isLoading || !ticket) return <Spinner />;
  return ticket.workstream === "MAINTENANCE" ? <MaintenanceTicketDetailPage /> : <ITTicketDetailPage />;
}
