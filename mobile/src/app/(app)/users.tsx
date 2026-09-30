import { Users } from "lucide-react-native";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function UsersScreen() {
  return (
    <ScreenPlaceholder
      icon={Users}
      title="Users — coming in Phase 4"
      description="Create, edit, and reset passwords for other accounts land next. (CSV bulk-import stays web-only.)"
    />
  );
}
