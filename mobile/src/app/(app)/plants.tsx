import { NamedListAdminScreen } from "@/features/admin-lists/NamedListAdminScreen";
import { createPlant, deletePlant, fetchAllPlants, updatePlant } from "@/api/plants";

export default function PlantsScreen() {
  return (
    <NamedListAdminScreen
      title="Plants"
      itemLabel="plant"
      hint="Plant / location list used on maintenance tickets. Letters and numbers only, words joined by a single underscore (e.g. Unit_1) - 3 to 20 characters, no spaces."
      placeholder="e.g. Unit_1"
      fetchAll={fetchAllPlants}
      create={createPlant}
      update={updatePlant}
      remove={deletePlant}
      queryKey="plants"
    />
  );
}
