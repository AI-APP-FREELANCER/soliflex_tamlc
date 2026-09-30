import { Tabs } from "expo-router";
import { LayoutGrid, LifeBuoy, Boxes, BarChart3, Users, ScrollText, UserCircle } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { canSeeHelpdesk, canSeeLegacy, canSeeUsersAndAudit } from "@/lib/roles";

export default function AppLayout() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F26522",
        tabBarInactiveTintColor: "#9A9DA6",
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Protected guard={canSeeHelpdesk(role)}>
        <Tabs.Screen
          name="helpdesk"
          options={{ title: "Helpdesk", tabBarIcon: ({ color, size }) => <LifeBuoy color={color} size={size} /> }}
        />
      </Tabs.Protected>

      <Tabs.Protected guard={canSeeLegacy(role)}>
        <Tabs.Screen
          name="tickets"
          options={{ title: "Board", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="assets"
          options={{ title: "Assets", tabBarIcon: ({ color, size }) => <Boxes color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: "Reports", tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }}
        />
      </Tabs.Protected>

      <Tabs.Protected guard={canSeeUsersAndAudit(role)}>
        <Tabs.Screen
          name="users"
          options={{ title: "Users", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="audit"
          options={{ title: "Audit", tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size} /> }}
        />
      </Tabs.Protected>

      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }}
      />
    </Tabs>
  );
}
