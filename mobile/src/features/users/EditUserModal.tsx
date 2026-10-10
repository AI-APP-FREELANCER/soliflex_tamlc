import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth.store";
import { assignableRoles } from "@/features/users/permissions";
import { useUserMutations } from "@/features/users/hooks";
import type { Role, User, Workstream } from "@/lib/types";

const WORKSTREAM_OPTIONS: { value: Workstream; label: string }[] = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "IT", label: "IT" },
];

interface EditUserModalProps {
  visible: boolean;
  user: User;
  onClose: () => void;
}

export function EditUserModal({ visible, user, onClose }: EditUserModalProps) {
  const actorRole = useAuthStore((s) => s.user?.role);
  const roleOptions = assignableRoles(actorRole).map((r) => ({ value: r, label: r }));
  const { update, resetPassword } = useUserMutations();

  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [workstream, setWorkstream] = useState<Workstream | undefined>(user.workstream ?? undefined);
  const [department, setDepartment] = useState(user.department ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");

  function handleSubmit() {
    update.mutate(
      {
        id: user.id,
        input: {
          name: name.trim(),
          role,
          workstream: workstream ?? null,
          department: department.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || null,
        },
      },
      { onSuccess: onClose }
    );
  }

  function handleResetPassword() {
    resetPassword.mutate(user.id, {
      onSuccess: (res) => Alert.alert("Password reset", `New temporary password: ${res.tempPassword}\n\nShare this with ${user.name} securely.`),
    });
  }

  function handleToggleActive() {
    update.mutate({ id: user.id, input: { active: !user.active } });
  }

  return (
    <Modal visible={visible} title={`Edit ${user.name}`} onClose={onClose}>
      <View className="gap-4 pb-4">
        <View>
          <Text className="text-xs text-soliflex-gray-500">Employee ID (fixed)</Text>
          <Text className="mt-1 text-sm text-soliflex-ink">{user.employeeId}</Text>
        </View>
        <TextField label="Name" value={name} onChangeText={setName} />
        <SelectField label="Role" value={role} options={roleOptions} onChange={setRole} />
        <SelectField label="Workstream" value={workstream} options={WORKSTREAM_OPTIONS} onChange={setWorkstream} />
        <TextField label="Department" value={department} onChangeText={setDepartment} />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Save" onPress={handleSubmit} loading={update.isPending} />
        <Button
          title={user.active ? "Deactivate" : "Activate"}
          variant="outline"
          onPress={handleToggleActive}
          loading={update.isPending}
        />
        <Button title="Reset password" variant="secondary" onPress={handleResetPassword} loading={resetPassword.isPending} />
      </View>
    </Modal>
  );
}
