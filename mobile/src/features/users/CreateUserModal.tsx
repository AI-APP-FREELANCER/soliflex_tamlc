import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth.store";
import { assignableRoles } from "@/features/users/permissions";
import { useUserMutations } from "@/features/users/hooks";
import { fetchDepartments } from "@/api/departments";
import { fetchUserDepartments } from "@/api/user-departments";
import { fetchDesignations } from "@/api/designations";
import type { Role, Workstream } from "@/lib/types";

const WORKSTREAM_OPTIONS: { value: Workstream; label: string }[] = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "IT", label: "IT" },
];

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateUserModal({ visible, onClose }: CreateUserModalProps) {
  const actorRole = useAuthStore((s) => s.user?.role);
  const roleOptions = assignableRoles(actorRole).map((r) => ({ value: r, label: r }));
  const { create } = useUserMutations();
  const { data: productCategories = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments, enabled: visible });
  const productCategoryOptions = [{ value: "", label: "No product category" }, ...productCategories.map((d) => ({ value: d.name, label: d.name }))];
  const { data: userDepartments = [] } = useQuery({ queryKey: ["user-departments"], queryFn: fetchUserDepartments, enabled: visible });
  const userDepartmentOptions = [{ value: "", label: "No department" }, ...userDepartments.map((d) => ({ value: d.name, label: d.name }))];
  const { data: designations = [] } = useQuery({ queryKey: ["designations"], queryFn: fetchDesignations, enabled: visible });
  const designationOptions = [{ value: "", label: "No designation" }, ...designations.map((d) => ({ value: d.name, label: d.name }))];

  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | undefined>();
  const [workstream, setWorkstream] = useState<Workstream | undefined>();
  const [department, setDepartment] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const isIT = workstream === "IT";

  function reset() {
    setEmployeeId("");
    setName("");
    setEmail("");
    setRole(undefined);
    setWorkstream(undefined);
    setDepartment("");
    setProductCategory("");
    setDesignation("");
    setPhone("");
  }

  function handleSubmit() {
    if (!role) return;
    create.mutate(
      {
        employeeId: employeeId.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        role,
        workstream: workstream ?? null,
        department: isIT ? undefined : department.trim() || undefined,
        productCategory: isIT ? undefined : productCategory.trim() || undefined,
        designation: isIT ? undefined : designation.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          reset();
          onClose();
          Alert.alert("User created", `Temporary password: ${res.tempPassword}\n\nShare this with ${res.user.name} securely — they'll be asked to change it on first login.`);
        },
      }
    );
  }

  const canSubmit = !!employeeId.trim() && !!name.trim() && (!!email.trim() || !!phone.trim()) && !!role;

  return (
    <Modal visible={visible} title="Add user" onClose={onClose}>
      <View className="gap-4 pb-4">
        <TextField label="Employee ID" value={employeeId} onChangeText={setEmployeeId} autoCapitalize="none" />
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Mobile number (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text className="-mt-2 text-xs text-soliflex-gray-500">At least one is required — the person signs in with whichever you enter.</Text>
        <SelectField label="Role" value={role} options={roleOptions} onChange={setRole} />
        <SelectField label="Workstream (optional)" value={workstream} options={WORKSTREAM_OPTIONS} onChange={setWorkstream} />
        {!isIT && (
          <>
            <SelectField label="Product category (optional)" value={productCategory} options={productCategoryOptions} onChange={setProductCategory} />
            <SelectField label="Department (optional)" value={department} options={userDepartmentOptions} onChange={setDepartment} />
            <SelectField label="Designation (optional)" value={designation} options={designationOptions} onChange={setDesignation} />
          </>
        )}
        <Button title="Create" onPress={handleSubmit} disabled={!canSubmit} loading={create.isPending} />
      </View>
    </Modal>
  );
}
