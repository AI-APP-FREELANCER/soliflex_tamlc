import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { useTicket } from "@/features/tickets/hooks";
import { Spinner } from "@/components/Spinner";
import ITTicketDetailScreen from "@/features/tickets/ITTicketDetailScreen";
import MaintenanceTicketDetailScreen from "@/features/tickets/MaintenanceTicketDetailScreen";

/** Maintenance and IT tickets have fully separate workflows (Oct 2026 redesign) - this just routes to the right one. */
export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicket(id);

  if (isLoading || !ticket || !id) {
    return (
      <SafeAreaView className="flex-1 bg-soliflex-gray-50" edges={["top"]}>
        <Stack.Screen options={{ title: "Ticket" }} />
        <Spinner />
      </SafeAreaView>
    );
  }

  return ticket.workstream === "MAINTENANCE" ? <MaintenanceTicketDetailScreen id={id} /> : <ITTicketDetailScreen id={id} />;
}
