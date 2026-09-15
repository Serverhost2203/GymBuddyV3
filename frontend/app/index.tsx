import { Redirect } from "expo-router";

import { useApp } from "@/src/context";

export default function Index() {
  const { user, loading } = useApp();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
