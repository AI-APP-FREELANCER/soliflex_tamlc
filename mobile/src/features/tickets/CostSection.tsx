import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
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
  const [isPart, setIsPart] = useState(false);
  const { addCost } = useTicketMutations(ticket.id);

  function handleAdd() {
    const amt = Number(amount);
    if (!description.trim() || !amt || amt <= 0) return;
    addCost.mutate(
      { id: ticket.id, description: description.trim(), amount: amt, sparePartUsed: isPart },
      { onSuccess: () => { setDescription(""); setAmount(""); setIsPart(false); } }
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
          {ticket.workstream === "MAINTENANCE" && (
            <Pressable onPress={() => setIsPart((v) => !v)} className="flex-row items-center gap-2">
              <View
                className={`h-5 w-5 items-center justify-center rounded border ${
                  isPart ? "border-soliflex-orange-500 bg-soliflex-orange-500" : "border-soliflex-gray-300"
                }`}
              >
                {isPart && <Check color="#fff" size={14} />}
              </View>
              <Text className="text-sm text-soliflex-ink">This is a spare part</Text>
            </Pressable>
          )}
          <Button title="Add" variant="secondary" onPress={handleAdd} loading={addCost.isPending} />
        </View>
      )}
    </View>
  );
}
