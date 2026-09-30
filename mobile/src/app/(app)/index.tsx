import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { canSeeHelpdesk } from "@/lib/roles";

export default function AppIndex() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  // Admin defaults to the legacy Board (same as web's HomeRedirect); every
  // other helpdesk-only role lands on Helpdesk.
  if (canSeeHelpdesk(role) && !isAdmin) {
    return <Redirect href="/(app)/helpdesk" />;
  }
  return <Redirect href="/(app)/tickets" />;
}
