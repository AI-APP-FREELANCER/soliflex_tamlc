import { Boxes } from "lucide-react-native";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function AssetsScreen() {
  return (
    <ScreenPlaceholder
      icon={Boxes}
      title="Asset Inventory — coming in Phase 3"
      description="Browsing, photos, and scan-a-QR-to-open-an-asset land next."
    />
  );
}
