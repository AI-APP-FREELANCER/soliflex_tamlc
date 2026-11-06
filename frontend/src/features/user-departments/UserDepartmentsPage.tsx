import { NamedListAdminPage } from "../../components/NamedListAdminPage";
import { createUserDepartment, deleteUserDepartment, fetchUserDepartments, updateUserDepartment } from "./api";

export default function UserDepartmentsPage() {
  return (
    <NamedListAdminPage
      title="Departments"
      itemLabel="department"
      hint="Org department list for staff profiles (e.g. Production, Maintenance, Quality, HR). For maintenance ticket/machine categories, see Product Categories."
      placeholder="e.g. Facility"
      fetchAll={fetchUserDepartments}
      create={createUserDepartment}
      update={updateUserDepartment}
      remove={deleteUserDepartment}
      queryKey="user-departments"
    />
  );
}
