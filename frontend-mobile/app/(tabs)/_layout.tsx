import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type TabConfig = {
  name: string;
  title: string;
  activeIcon: IoniconName;
  inactiveIcon: IoniconName;
};

const TABS: TabConfig[] = [
  {
    name: "index",
    title: "Today",
    activeIcon: "today",
    inactiveIcon: "today-outline",
  },
  {
    name: "capture",
    title: "Capture",
    activeIcon: "add-circle",
    inactiveIcon: "add-circle-outline",
  },
  {
    name: "roles",
    title: "Roles",
    activeIcon: "people",
    inactiveIcon: "people-outline",
  },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#fff",
          paddingBottom: 4,
        },
        headerStyle: { backgroundColor: "#4f46e5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {TABS.map(({ name, title, activeIcon, inactiveIcon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? activeIcon : inactiveIcon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
