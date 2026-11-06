import { NamedListAdminPage } from "../../components/NamedListAdminPage";
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment } from "./api";

export default function DepartmentsPage() {
  return (
    <NamedListAdminPage
      title="Product Categories"
      itemLabel="product category"
      hint="Product category list used on maintenance tickets and machines (e.g. Fabric, Cutting, Finishing). For staff org departments, see Departments."
      placeholder="e.g. Container liner"
      fetchAll={fetchDepartments}
      create={createDepartment}
      update={updateDepartment}
      remove={deleteDepartment}
      queryKey="departments"
    />
  );
}
