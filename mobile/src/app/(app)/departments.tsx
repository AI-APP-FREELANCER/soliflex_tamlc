import { NamedListAdminScreen } from "@/features/admin-lists/NamedListAdminScreen";
import { createDepartment, deleteDepartment, fetchAllDepartments, updateDepartment } from "@/api/departments";

export default function DepartmentsScreen() {
  return (
    <NamedListAdminScreen
      title="Product Categories"
      itemLabel="product category"
      hint="Product category list used on maintenance tickets and machines (e.g. Fabric, Cutting, Finishing). For staff org departments, see Departments."
      placeholder="e.g. Container liner"
      fetchAll={fetchAllDepartments}
      create={createDepartment}
      update={updateDepartment}
      remove={deleteDepartment}
      queryKey="departments"
    />
  );
}
