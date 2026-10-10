import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth.store";
import { assignableRoles } from "@/features/users/permissions";
import { useUserMutations } from "@/features/users/hooks";
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

  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | undefined>();
  const [workstream, setWorkstream] = useState<Workstream | undefined>();
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");

  function reset() {
    setEmployeeId("");
    setName("");
    setEmail("");
    setRole(undefined);
    setWorkstream(undefined);
    setDepartment("");
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
        department: department.trim() || undefined,
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
        <TextField label="Department (optional)" value={department} onChangeText={setDepartment} />
        <Button title="Create" onPress={handleSubmit} disabled={!canSubmit} loading={create.isPending} />
      </View>
    </Modal>
  );
}
