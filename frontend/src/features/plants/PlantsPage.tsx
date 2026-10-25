import { NamedListAdminPage } from "../../components/NamedListAdminPage";
import { createPlant, deletePlant, fetchPlants, updatePlant } from "./api";

export default function PlantsPage() {
  return (
    <NamedListAdminPage
      title="Plants"
      itemLabel="plant"
      hint="Plant / location list used on maintenance tickets. Letters and numbers only, words joined by a single underscore (e.g. Unit_1) - 3 to 20 characters, no spaces."
      placeholder="e.g. Unit_1"
      fetchAll={fetchPlants}
      create={createPlant}
      update={updatePlant}
      remove={deletePlant}
      queryKey="plants"
    />
  );
}
