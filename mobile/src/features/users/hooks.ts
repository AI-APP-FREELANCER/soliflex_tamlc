import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-client";
import { createUser, fetchUsers, resetUserPassword, updateUser, type CreateUserInput, type UpdateUserInput } from "@/api/users";

export function useUsersList() {
  return useQuery({ queryKey: ["users"], queryFn: fetchUsers });
}

function onErr(err: unknown) {
  Alert.alert("Something went wrong", apiErrorMessage(err));
}

export function useUserMutations() {
  const qc = useQueryClient();
  function invalidate() {
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  const create = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
    onError: onErr,
  });

  return { create, update, resetPassword };
}
