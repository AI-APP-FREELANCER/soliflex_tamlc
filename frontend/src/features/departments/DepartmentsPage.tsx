import { NamedListAdminPage } from "../../components/NamedListAdminPage";
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment } from "./api";

export default function DepartmentsPage() {
  return (
    <NamedListAdminPage
      title="Departments"
      itemLabel="department"
      hint="Department / product category list used on maintenance tickets (e.g. Fabric, Cutting, Finishing)."
      placeholder="e.g. Container liner"
      fetchAll={fetchDepartments}
      create={createDepartment}
      update={updateDepartment}
      remove={deleteDepartment}
      queryKey="departments"
    />
  );
}
