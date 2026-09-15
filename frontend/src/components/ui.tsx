import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Pressable, ScrollView, StyleProp, Text, TextStyle,
  View, ViewStyle,
} from "react-native";

import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// ---------------------------------------------------------------- Button
export function Button({
  title, onPress, variant = "primary", loading, disabled, icon, style, testID, small,
}: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean; disabled?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle>;
  testID?: string; small?: boolean;
}) {
  const s = useBtnStyles();
  const { colors } = useTheme();
  const bg = variant === "primary" ? s.primary : variant === "secondary" ? s.secondary
    : variant === "danger" ? s.danger : s.ghost;
  const txt = variant === "primary" ? colors.onBrandPrimary : variant === "danger" ? colors.onError
    : variant === "secondary" ? colors.onSurfaceTertiary : colors.brandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.base, bg, small && s.small, pressed && s.pressed, (disabled || loading) && s.disabled, style]}
    >
      {loading ? <ActivityIndicator color={txt} /> : (
        <View style={s.row}>
          {icon}
          <Text style={[s.text, { color: txt }, small && s.textSmall]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const useBtnStyles = makeStyles((c) => ({
  base: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  small: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  danger: { backgroundColor: c.error },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: c.borderStrong },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  text: { fontSize: font.lg, fontWeight: "700", fontFamily: font.text },
  textSmall: { fontSize: font.base },
}));

// ---------------------------------------------------------------- Card
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const s = useCardStyles();
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}
const useCardStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
}));

// ---------------------------------------------------------------- Chip
export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const s = useChipStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.chip, active && s.active]}>
      <Text style={[s.text, active && s.textActive]}>{label}</Text>
    </Pressable>
  );
}
const useChipStyles = makeStyles((c) => ({
  chip: { height: 36, flexShrink: 0, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  active: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  text: { color: c.onSurfaceTertiary, fontSize: font.base, fontWeight: "600", fontFamily: font.text },
  textActive: { color: c.onBrandPrimary },
}));

// ---------------------------------------------------------------- ChipRow
export function ChipRow({ children }: { children: React.ReactNode }) {
  const s = useChipRowStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={s.wrap}>
      {children}
    </ScrollView>
  );
}
const useChipRowStyles = makeStyles(() => ({
  wrap: { maxHeight: 56 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 },
}));

// ---------------------------------------------------------------- Heading
export function Display({ children, size = font["2xl"], style }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ fontFamily: font.display, fontWeight: "700", color: colors.onSurface, fontSize: size }, style]}>{children}</Text>;
}
export function Body({ children, muted, style, size = font.base }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; size?: number }) {
  const { colors } = useTheme();
  return <Text style={[{ fontFamily: font.text, color: muted ? colors.muted : colors.onSurface, fontSize: size }, style]}>{children}</Text>;
}

// ---------------------------------------------------------------- StatCard
export function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const s = useStatStyles();
  return (
    <View style={s.card}>
      <Text style={[s.value, accent && s.accent]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}
const useStatStyles = makeStyles((c) => ({
  card: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 2 },
  value: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface },
  accent: { color: c.brandPrimary },
  label: { fontFamily: font.text, fontSize: font.sm, color: c.muted, textAlign: "center" },
}));

// ---------------------------------------------------------------- EmptyState
export function EmptyState({ title, subtitle, action, icon, testID }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ReactNode; testID?: string }) {
  const s = useEmptyStyles();
  return (
    <View style={s.wrap} testID={testID}>
      {icon}
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
      {action}
    </View>
  );
}
const useEmptyStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.md },
  title: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface, textAlign: "center" },
  sub: { fontFamily: font.text, fontSize: font.base, color: c.muted, textAlign: "center" },
}));

// ---------------------------------------------------------------- Skeleton
export function Skeleton({ height = 60, width = "100%", style }: { height?: number; width?: any; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const op = useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={[{ height, width, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, opacity: op }, style]} />;
}

// ---------------------------------------------------------------- Segmented
export function Segmented({ options, value, onChange, testID }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; testID?: string }) {
  const s = useSegStyles();
  return (
    <View style={s.wrap} testID={testID}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.item, value === o.key && s.active]} testID={`${testID}-${o.key}`}>
          <Text style={[s.text, value === o.key && s.textActive]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const useSegStyles = makeStyles((c) => ({
  wrap: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 3 },
  item: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  active: { backgroundColor: c.brandPrimary },
  text: { fontFamily: font.text, fontSize: font.sm, fontWeight: "600", color: c.muted },
  textActive: { color: c.onBrandPrimary },
}));

// ---------------------------------------------------------------- Ring
export function ProgressRing({ progress, size = 60, label }: { progress: number; size?: number; label?: string }) {
  const s = useRingStyles();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[s.fill, { height: size * pct, borderRadius: size / 2 }]} />
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}
const useRingStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2, borderColor: c.brandPrimary },
  fill: { position: "absolute", bottom: 0, width: "100%", backgroundColor: c.brandTertiary },
  label: { fontFamily: font.display, fontWeight: "700", color: c.onSurface, fontSize: font.base },
}));

// ---------------------------------------------------------------- Toast
type ToastCtx = { show: (msg: string, kind?: "info" | "success" | "error") => void };
const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: string } | null>(null);
  const y = useRef(new Animated.Value(120)).current;
  const s = useToastStyles();
  const show = useCallback((text: string, kind: "info" | "success" | "error" = "info") => {
    setMsg({ text, kind });
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(y, { toValue: 120, duration: 250, useNativeDriver: true }).start(() => setMsg(null));
    }, 2600);
  }, [y]);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View style={[s.toast, msg.kind === "error" && s.error, msg.kind === "success" && s.success, { transform: [{ translateY: y }] }]} pointerEvents="none">
          <Text style={s.text}>{msg.text}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
const useToastStyles = makeStyles((c) => ({
  toast: { position: "absolute", bottom: 90, left: spacing.lg, right: spacing.lg, backgroundColor: c.surfaceInverse, padding: spacing.lg, borderRadius: radius.md, zIndex: 9999 },
  error: { backgroundColor: c.error },
  success: { backgroundColor: c.success },
  text: { color: c.onSurfaceInverse, fontFamily: font.text, fontWeight: "600", textAlign: "center" },
}));
