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

  return (
    <Pressable onPress={onPress} className="border-b border-soliflex-gray-100 bg-white px-4 py-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-xs font-semibold text-soliflex-gray-500">{ticket.ticketNumber}</Text>
          <Text className="mt-0.5 text-sm font-semibold text-soliflex-ink" numberOfLines={2}>
            {ticket.title}
          </Text>
        </View>
        <Badge label={TICKET_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Text className="text-xs text-soliflex-gray-500">{TICKET_CATEGORY_LABELS[ticket.category]}</Text>
        <Text className="text-xs text-soliflex-gray-500">{ticket.assignedTo?.name ?? "Unassigned"}</Text>
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
