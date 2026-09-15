// GymBuddy theme tokens — dark (primary) + light. Keys mirror the "color"
// block of design_guidelines.json. Use makeStyles() for stylesheets and
// useTheme().colors for color props.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0F1113",
  onSurface: "#F5F6F8",
  surfaceSecondary: "#1A1C20",
  onSurfaceSecondary: "#E2E4E9",
  surfaceTertiary: "#25282E",
  onSurfaceTertiary: "#D1D4DB",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0F1113",
  brand: "#FF5522",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF5522",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF7744",
  onBrandSecondary: "#1A0803",
  brandTertiary: "#331811",
  onBrandTertiary: "#FF8866",
  success: "#00E676",
  onSuccess: "#002B16",
  warning: "#FFB300",
  onWarning: "#332400",
  error: "#FF3B30",
  onError: "#330806",
  border: "#272A30",
  borderStrong: "#3B4048",
  divider: "#1A1C20",
  muted: "#8A919E",
};

const light: typeof dark = {
  surface: "#FFFFFF",
  onSurface: "#0F1113",
  surfaceSecondary: "#F4F5F8",
  onSurfaceSecondary: "#1A1C20",
  surfaceTertiary: "#EAECEF",
  onSurfaceTertiary: "#25282E",
  surfaceInverse: "#0F1113",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF5522",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF4411",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF6633",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FFF0EC",
  onBrandTertiary: "#CC3300",
  success: "#00C853",
  onSuccess: "#FFFFFF",
  warning: "#F57F17",
  onWarning: "#FFFFFF",
  error: "#D32F2F",
  onError: "#FFFFFF",
  border: "#E1E4E8",
  borderStrong: "#C2C7D0",
  divider: "#F4F5F8",
  muted: "#687078",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

// Design tokens
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 16, pill: 999 };
export const font = {
  display: "Rajdhani",
  text: "Manrope",
  sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 48, "4xl": 64,
};

const THEME_KEY = "gb_theme_pref";
let override: ColorScheme | null = null;
const listeners = new Set<() => void>();

export function setColorScheme(scheme: ColorScheme | null) {
  override = scheme;
  Appearance.setColorScheme?.(scheme ?? "unspecified");
  storage.setItem(THEME_KEY, scheme ?? "system");
  listeners.forEach((l) => l());
}

export async function loadThemePref() {
  const saved = await storage.getItem<string>(THEME_KEY, "system");
  if (saved === "light" || saved === "dark") {
    override = saved;
    Appearance.setColorScheme?.(saved);
  }
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = override ?? (system === "light" ? "light" : "dark");
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Default to dark
Appearance.setColorScheme?.("dark");
