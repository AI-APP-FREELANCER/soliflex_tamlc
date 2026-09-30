import { LayoutGrid } from "lucide-react-native";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function TicketsScreen() {
  return (
    <ScreenPlaceholder
      icon={LayoutGrid}
      title="Maintenance / IT Board — coming in Phase 2"
      description="The full ticket workflow, attachments via your camera, and cost entries land next."
    />
  );
}
