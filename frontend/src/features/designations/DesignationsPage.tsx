import { NamedListAdminPage } from "../../components/NamedListAdminPage";
import { createDesignation, deleteDesignation, fetchDesignations, updateDesignation } from "./api";

export default function DesignationsPage() {
  return (
    <NamedListAdminPage
      title="Designations"
      itemLabel="designation"
      hint="Designation list a ticket raiser can pick from (e.g. Supervisor, In Charge, Electrician, Engineer). A label only - carries no permissions."
      placeholder="e.g. Shift Supervisor"
      fetchAll={fetchDesignations}
      create={createDesignation}
      update={updateDesignation}
      remove={deleteDesignation}
      queryKey="designations"
    />
  );
}
