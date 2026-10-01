import { useState } from "react";
import { Text, View } from "react-native";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { Ticket } from "@/lib/types";

interface CostSectionProps {
  ticket: Ticket;
  canEdit: boolean;
}

export function CostSection({ ticket, canEdit }: CostSectionProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const { addCost } = useTicketMutations(ticket.id);

  function handleAdd() {
    const amt = Number(amount);
    if (!description.trim() || !amt || amt <= 0) return;
    addCost.mutate(
      { id: ticket.id, description: description.trim(), amount: amt },
      { onSuccess: () => { setDescription(""); setAmount(""); } }
    );
  }

  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Cost & spare parts</Text>
      {ticket.costEntries?.length ? (
        ticket.costEntries.map((c) => (
          <View key={c.id} className="flex-row items-center justify-between border-b border-soliflex-gray-50 py-2">
            <Text className="flex-1 text-sm text-soliflex-ink">
              {c.description}
              {c.sparePartUsed ? " (spare part)" : ""}
            </Text>
            <Text className="text-sm font-medium text-soliflex-ink">₹{c.amount.toLocaleString("en-IN")}</Text>
          </View>
        ))
      ) : (
        <Text className="text-sm text-soliflex-gray-500">No cost entries yet.</Text>
      )}
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-soliflex-ink">Total</Text>
        <Text className="text-sm font-semibold text-soliflex-ink">₹{(ticket.actualCost ?? 0).toLocaleString("en-IN")}</Text>
      </View>

      {canEdit && (
        <View className="mt-3 gap-2">
          <TextField placeholder="Description" value={description} onChangeText={setDescription} />
          <TextField placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <Button title="Add" variant="secondary" onPress={handleAdd} loading={addCost.isPending} />
        </View>
      )}
    </View>
  );
}
