import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/ui";
import { AppProvider, useApp } from "@/src/context";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { user, loading } = useApp();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const inAuth = seg0 === "(auth)";
    const inOnboarding = seg0 === "onboarding";
    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && !user.onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (user && user.onboarded && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rajdhani: require("../assets/fonts/Rajdhani-Bold.ttf"),
    RajdhaniSemi: require("../assets/fonts/Rajdhani-SemiBold.ttf"),
    Manrope: require("../assets/fonts/Manrope-Regular.ttf"),
    ManropeBold: require("../assets/fonts/Manrope-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AppProvider>
                <ToastProvider>
                  <Gate />
                </ToastProvider>
              </AppProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
