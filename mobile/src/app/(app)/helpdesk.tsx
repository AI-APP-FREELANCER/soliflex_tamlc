import { LifeBuoy } from "lucide-react-native";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function HelpdeskScreen() {
  return (
    <ScreenPlaceholder
      icon={LifeBuoy}
      title="Helpdesk — coming in Phase 1"
      description="Raising tickets, tracking your queue, assigning with deadlines, and the full status workflow land next."
    />
  );
}
