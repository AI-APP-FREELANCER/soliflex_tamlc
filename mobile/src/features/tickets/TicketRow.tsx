import { Pressable, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { formatIST } from "@/lib/formatIST";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/features/helpdesk/badges";
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from "@/features/tickets/badges";
import type { Ticket } from "@/lib/types";

interface TicketRowProps {
  ticket: Ticket;
  onPress: () => void;
}

export function TicketRow({ ticket, onPress }: TicketRowProps) {
  const statusColor = TICKET_STATUS_COLORS[ticket.status];
  const isHigh = ticket.priority === "HIGH";

  return (
    <Pressable onPress={onPress} className={`border-b border-soliflex-gray-100 bg-white px-4 py-3 ${isHigh ? "border-l-2 border-l-red-400" : ""}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          {ticket.machine ? (
            <>
              <Text className={`text-sm font-semibold ${isHigh ? "text-red-700" : "text-soliflex-ink"}`}>
                {ticket.machine.name} <Text className="font-normal text-soliflex-gray-400">({ticket.machine.itemCode})</Text>
              </Text>
              <Text className="text-xs text-soliflex-gray-500" numberOfLines={1}>
                {ticket.ticketNumber} · {ticket.displayTitle}
              </Text>
            </>
          ) : (
            <>
              <Text className={`text-xs font-semibold ${isHigh ? "text-red-700" : "text-soliflex-gray-500"}`}>{ticket.ticketNumber}</Text>
              <Text className="mt-0.5 text-sm font-semibold text-soliflex-ink" numberOfLines={2}>
                {ticket.displayTitle}
              </Text>
            </>
          )}
        </View>
        <Badge label={TICKET_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {!ticket.machine && <Text className="text-xs text-soliflex-gray-500">{TICKET_CATEGORY_LABELS[ticket.category]}</Text>}
        <Text className="text-xs text-soliflex-gray-500">Owner: {ticket.reportedBy?.name ?? "—"}</Text>
        <Text className="text-xs text-soliflex-gray-500">Assignee: {ticket.assignedTo?.name ?? "Unassigned"}</Text>
        <Text className="text-xs text-soliflex-gray-500">{formatIST(ticket.createdAt, "dd MMM yyyy")}</Text>
      </View>

      {(ticket.onHold || ticket.slaBreached || ticket.priority) && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {ticket.priority && (
            <Badge label={PRIORITY_LABELS[ticket.priority]} bg={PRIORITY_COLORS[ticket.priority].bg} text={PRIORITY_COLORS[ticket.priority].text} />
          )}
          {ticket.onHold && <Badge label="On hold" bg="#FFFBEB" text="#B45309" />}
          {ticket.slaBreached && <Badge label="SLA breached" bg="#FEF2F2" text="#B91C1C" />}
        </View>
      )}
    </Pressable>
  );
}
