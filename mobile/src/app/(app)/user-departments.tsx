import { NamedListAdminScreen } from "@/features/admin-lists/NamedListAdminScreen";
import { createUserDepartment, deleteUserDepartment, fetchAllUserDepartments, updateUserDepartment } from "@/api/user-departments";

export default function UserDepartmentsScreen() {
  return (
    <NamedListAdminScreen
      title="Departments"
      itemLabel="department"
      hint="Org department list for staff profiles (e.g. Production, Maintenance, Quality, HR). For maintenance ticket/machine categories, see Product Categories."
      placeholder="e.g. Facility"
      fetchAll={fetchAllUserDepartments}
      create={createUserDepartment}
      update={updateUserDepartment}
      remove={deleteUserDepartment}
      queryKey="user-departments"
    />
  );
}
