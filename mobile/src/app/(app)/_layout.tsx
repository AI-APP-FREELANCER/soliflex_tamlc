import { Drawer } from "expo-router/drawer";
import { LayoutGrid, LifeBuoy, Boxes, BarChart3, Users, ScrollText, UserCircle } from "lucide-react-native";
import { useAuthStore } from "@/store/auth.store";
import { canSeeHelpdesk, canSeeLegacy, canSeeUsersAndAudit } from "@/lib/roles";
import { useRealtimeSync } from "@/lib/useRealtimeSync";

export default function AppLayout() {
  const role = useAuthStore((s) => s.user?.role);
  useRealtimeSync();

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: "#F26522",
        drawerInactiveTintColor: "#55504A",
        drawerActiveBackgroundColor: "#FBEADB",
      }}
    >
      <Drawer.Screen name="index" options={{ drawerItemStyle: { height: 0, width: 0 } }} />

      <Drawer.Protected guard={canSeeHelpdesk(role)}>
        <Drawer.Screen
          name="helpdesk"
          options={{ title: "Helpdesk", drawerIcon: ({ color, size }) => <LifeBuoy color={color} size={size} /> }}
        />
      </Drawer.Protected>

      <Drawer.Protected guard={canSeeLegacy(role)}>
        <Drawer.Screen
          name="tickets"
          options={{ title: "Board", drawerIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
        />
        <Drawer.Screen
          name="assets"
          options={{ title: "Assets", drawerIcon: ({ color, size }) => <Boxes color={color} size={size} /> }}
        />
        <Drawer.Screen
          name="reports"
          options={{ title: "Reports", drawerIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }}
        />
      </Drawer.Protected>

      <Drawer.Protected guard={canSeeUsersAndAudit(role)}>
        <Drawer.Screen
          name="users"
          options={{ title: "Users", drawerIcon: ({ color, size }) => <Users color={color} size={size} /> }}
        />
        <Drawer.Screen
          name="audit"
          options={{ title: "Audit", drawerIcon: ({ color, size }) => <ScrollText color={color} size={size} /> }}
        />
      </Drawer.Protected>

      <Drawer.Screen
        name="profile"
        options={{ title: "Profile", drawerIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }}
      />
    </Drawer>
  );
}
