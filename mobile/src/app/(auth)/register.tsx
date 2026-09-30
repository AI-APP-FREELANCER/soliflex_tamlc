import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as auth from "@/api/auth";
import { apiErrorMessage, persistRefreshToken } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

export default function RegisterScreen() {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);

  const mutation = useMutation({
    mutationFn: () => auth.registerEmployee({ employeeId, name, email, phone: phone || undefined, password }),
    onSuccess: async (res) => {
      await persistRefreshToken(res.refreshToken);
      setSession(res.accessToken, res.user);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    mutation.mutate();
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow px-6 pb-10 pt-16" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-soliflex-ink">Create your account</Text>
        <Text className="mt-2 text-sm text-soliflex-gray-500">
          For employees raising IT support requests. Use your company email —{" "}
          <Text className="font-medium">@soliflexpackaging.com</Text> or{" "}
          <Text className="font-medium">@indautogroup.com</Text>.
        </Text>

        <View className="mt-6 gap-4">
          <TextField label="Employee ID" value={employeeId} onChangeText={setEmployeeId} placeholder="EMP-1234" autoCapitalize="characters" />
          <TextField label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />
          <TextField
            label="Company email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@soliflexpackaging.com"
          />
          <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9876543210" />
          <View>
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••••" />
            <Text className="mt-1 text-xs text-soliflex-gray-400">
              At least 10 characters, with an uppercase letter, lowercase letter, number, and symbol.
            </Text>
          </View>
          <TextField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••••" />

          {error && (
            <View className="rounded-md bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          <Button title="Create account" onPress={handleSubmit} loading={mutation.isPending} />
        </View>

        <Text className="mt-6 text-xs text-soliflex-gray-400" onPress={() => router.replace("/(auth)")}>
          Already have an account? <Text className="font-semibold text-soliflex-orange-600">Sign in</Text>
        </Text>
        <Text className="mt-2 text-xs text-soliflex-gray-400">
          IT Support Engineer, Team Lead, or Admin? Ask your Admin for an account — those roles aren&apos;t self-service.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
