import { Pressable, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatIST } from "@/lib/formatIST";
import { HELPDESK_CATEGORY_LABELS, HELPDESK_STATUS_COLORS, HELPDESK_STATUS_LABELS } from "@/features/helpdesk/badges";
import { canAssignTicket } from "@/features/helpdesk/permissions";
import type { HelpdeskTicket, User } from "@/lib/types";

interface TicketRowProps {
  ticket: HelpdeskTicket;
  user: User | null;
  showRaisedBy: boolean;
  onPress: () => void;
  onAssign: () => void;
}

export function TicketRow({ ticket, user, showRaisedBy, onPress, onAssign }: TicketRowProps) {
  const statusColor = HELPDESK_STATUS_COLORS[ticket.status];
  const missingDeadline = ["ASSIGNED", "IN_PROGRESS"].includes(ticket.status) && !ticket.deadline;

  return (
    <Pressable onPress={onPress} className="border-b border-soliflex-gray-100 bg-white px-4 py-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-xs font-semibold text-soliflex-gray-500">{ticket.ticketNumber}</Text>
          <Text className="mt-0.5 text-sm font-semibold text-soliflex-ink" numberOfLines={2}>
            {ticket.title}
          </Text>
        </View>
        <Badge label={HELPDESK_STATUS_LABELS[ticket.status]} bg={statusColor.bg} text={statusColor.text} />
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Text className="text-xs text-soliflex-gray-500">{HELPDESK_CATEGORY_LABELS[ticket.category]}</Text>
        {showRaisedBy && (
          <Text className="text-xs text-soliflex-gray-500">Raised by {ticket.raisedBy?.name ?? "—"}</Text>
        )}
        <Text className="text-xs text-soliflex-gray-500">{ticket.assignedTo?.name ?? "Unassigned"}</Text>
        <Text className="text-xs text-soliflex-gray-500">
          {ticket.deadline ? formatIST(ticket.deadline, "dd MMM, HH:mm") : "No deadline"}
        </Text>
      </View>

      {(ticket.onHold || ticket.deadlineBreached || missingDeadline) && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {ticket.onHold && <Badge label="On hold" bg="#FFFBEB" text="#B45309" />}
          {ticket.deadlineBreached && <Badge label="Deadline breached" bg="#FEF2F2" text="#B91C1C" />}
          {missingDeadline && <Badge label="Missing deadline" bg="#F3F4F6" text="#374151" />}
        </View>
      )}

      {canAssignTicket(ticket, user) && (
        <View className="mt-3">
          <Button
            title={ticket.assignedToId ? "Reassign" : "Assign"}
            variant="outline"
            onPress={onAssign}
          />
        </View>
      )}
    </Pressable>
  );
}
