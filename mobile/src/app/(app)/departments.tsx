import { NamedListAdminScreen } from "@/features/admin-lists/NamedListAdminScreen";
import { createDepartment, deleteDepartment, fetchAllDepartments, updateDepartment } from "@/api/departments";

export default function DepartmentsScreen() {
  return (
    <NamedListAdminScreen
      title="Departments"
      itemLabel="department"
      hint="Department / product category list used on maintenance tickets (e.g. Fabric, Cutting, Finishing)."
      placeholder="e.g. Container liner"
      fetchAll={fetchAllDepartments}
      create={createDepartment}
      update={updateDepartment}
      remove={deleteDepartment}
      queryKey="departments"
    />
  );
}
