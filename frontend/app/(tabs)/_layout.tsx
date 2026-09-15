import { Tabs } from "expo-router";
import { ChartLineUp, House, Barbell, User, UsersThree } from "phosphor-react-native";
import { Platform } from "react-native";

import { useApp } from "@/src/context";
import { font, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.text, fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color, size }) => <House color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="feed" options={{ title: t.feed.title, tabBarIcon: ({ color, size }) => <UsersThree color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="workouts" options={{ title: t.tabs.workouts, tabBarIcon: ({ color, size }) => <Barbell color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="progress" options={{ title: t.tabs.progress, tabBarIcon: ({ color, size }) => <ChartLineUp color={color} size={size} weight="fill" /> }} />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarIcon: ({ color, size }) => <User color={color} size={size} weight="fill" /> }} />
    </Tabs>
  );
}
