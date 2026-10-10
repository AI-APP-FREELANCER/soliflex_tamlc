import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as auth from "@/api/auth";
import { apiErrorMessage, persistRefreshToken } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

type LoginTab = "employee" | "staff";

export default function LoginScreen() {
  const [tab, setTab] = useState<LoginTab>("employee");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);

  const mutation = useMutation({
    mutationFn: () => auth.login(identifier, password),
    onSuccess: async (res) => {
      await persistRefreshToken(res.refreshToken);
      setSession(res.accessToken, res.user);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit() {
    setError(null);
    mutation.mutate();
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled">
        <View className="bg-soliflex-orange-500 px-6 pb-10 pt-20">
          <Text className="text-3xl font-extrabold text-white">Soliflex</Text>
          <Text className="mt-1 text-base text-white/90">Ticketing &amp; Asset Management</Text>
        </View>

        <View className="flex-1 px-6 pt-6">
          <Text className="text-2xl font-bold text-soliflex-ink">Sign in</Text>

          <View className="mt-4 flex-row gap-1 rounded-lg bg-soliflex-gray-100 p-1">
            <Pressable
              onPress={() => setTab("employee")}
              className={`flex-1 rounded-md py-2 ${tab === "employee" ? "bg-white shadow-card" : ""}`}
            >
              <Text
                className={`text-center text-xs font-semibold ${tab === "employee" ? "text-soliflex-orange-600" : "text-soliflex-gray-500"}`}
              >
                Employee — Raise an IT issue
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("staff")}
              className={`flex-1 rounded-md py-2 ${tab === "staff" ? "bg-white shadow-card" : ""}`}
            >
              <Text
                className={`text-center text-xs font-semibold ${tab === "staff" ? "text-soliflex-orange-600" : "text-soliflex-gray-500"}`}
              >
                IT Support / Maintenance Staff
              </Text>
            </Pressable>
          </View>

          <Text className="mt-3 text-sm text-soliflex-gray-500">
            {tab === "employee"
              ? "Sign in to submit and track your own IT support requests."
              : "For IT Support Engineers, Team Leads, Mechanics, Managers, and Admins."}
          </Text>

          <View className="mt-6 gap-4">
            <TextField
              label="Email or mobile number"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoComplete="username"
              placeholder="you@soliflexpackaging.com or 9876543210"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />

            {error && (
              <View className="rounded-md bg-red-50 px-3 py-2">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            )}

            <Button title="Sign in" onPress={handleSubmit} loading={mutation.isPending} />
          </View>

          {tab === "employee" ? (
            <Text className="mt-6 text-xs text-soliflex-gray-400">
              New here?{" "}
              <Link href="/(auth)/register" className="font-semibold text-soliflex-orange-600">
                Create your account
              </Link>{" "}
              with your company email or your mobile number.
            </Text>
          ) : (
            <Text className="mt-6 text-xs text-soliflex-gray-400">
              Maintenance and IT staff accounts are created by your Admin. You can also{" "}
              <Link href="/(auth)/register" className="font-semibold text-soliflex-orange-600">
                register with your mobile number
              </Link>{" "}
              and ask your Admin to set up your access.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
