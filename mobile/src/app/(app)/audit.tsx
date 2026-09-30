import { ScrollText } from "lucide-react-native";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function AuditScreen() {
  return (
    <ScreenPlaceholder
      icon={ScrollText}
      title="Audit Log — coming in Phase 4"
      description="The immutable change history lands next."
    />
  );
}
