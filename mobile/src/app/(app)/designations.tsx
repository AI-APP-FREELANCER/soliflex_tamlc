import { NamedListAdminScreen } from "@/features/admin-lists/NamedListAdminScreen";
import { createDesignation, deleteDesignation, fetchAllDesignations, updateDesignation } from "@/api/designations";

export default function DesignationsScreen() {
  return (
    <NamedListAdminScreen
      title="Designations"
      itemLabel="designation"
      hint="Designation list a ticket raiser can pick from (e.g. Supervisor, In Charge, Electrician, Engineer). A label only - carries no permissions."
      placeholder="e.g. Shift Supervisor"
      fetchAll={fetchAllDesignations}
      create={createDesignation}
      update={updateDesignation}
      remove={deleteDesignation}
      queryKey="designations"
    />
  );
}
