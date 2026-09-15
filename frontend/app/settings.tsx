import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Chip, Display, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DURATIONS = [30, 45, 60, 75, 90];

export default function Settings() {
  const { t, lang, user, updateUser } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const s = useStyles();

  const meta = useQuery({ queryKey: ["meta", lang], queryFn: () => api.get("/exercises/meta", { lang }) });
  const [f, setF] = useState({
    name: user?.name ?? "", height_cm: String(user?.height_cm ?? ""), weight_kg: String(user?.weight_kg ?? ""),
    target_weight_kg: String(user?.target_weight_kg ?? ""), goal: user?.goal ?? "", experience: user?.experience ?? "",
    training_days: user?.training_days ?? [], workout_duration_min: user?.workout_duration_min ?? 60,
    equipment: user?.equipment ?? ["bodyweight"],
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: string, arr: string[], v: string) => set(k, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: f.name.trim(), height_cm: parseFloat(f.height_cm) || undefined,
        weight_kg: parseFloat(f.weight_kg) || undefined, target_weight_kg: parseFloat(f.target_weight_kg) || undefined,
        goal: f.goal || undefined, experience: f.experience || undefined, training_days: f.training_days,
        workout_duration_min: f.workout_duration_min, equipment: f.equipment,
      };
      const u = await api.put("/users/me", payload);
      updateUser(u);
      toast.show(t.common.save, "success");
      router.back();
    } catch { toast.show(t.errors.generic, "error"); } finally { setSaving(false); }
  };

  const numField = (k: string, label: string, unit: string) => (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.numWrap}>
        <TextInput style={s.numInput} value={(f as any)[k]} keyboardType="decimal-pad"
          onChangeText={(v) => set(k, v.replace(/[^0-9.]/g, ""))} testID={`set-${k}`} placeholderTextColor={colors.muted} />
        <Text style={s.unit}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <CaretLeft color={colors.onSurface} size={26} onPress={() => router.back()} testID="settings-back" />
        <Display size={font.xl}>{t.profile.editProfile}</Display>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} bottomOffset={20}>
        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={s.label}>{t.auth.name}</Text>
            <TextInput style={s.input} value={f.name} onChangeText={(v) => set("name", v)} testID="set-name" placeholderTextColor={colors.muted} />
          </View>
          <View style={s.row}>{numField("height_cm", t.progress.bmi === "BMI" ? t.onboarding.heightQ : t.onboarding.heightQ, "cm")}{numField("weight_kg", t.onboarding.weightQ, "kg")}</View>
          {numField("target_weight_kg", t.onboarding.targetQ, "kg")}
        </Card>

        <Text style={s.section}>{t.onboarding.goalQ}</Text>
        <View style={s.wrapRow}>
          {(meta.data?.goals ?? []).map((g: any) => <Chip key={g.slug} label={g.label} active={f.goal === g.slug} onPress={() => set("goal", g.slug)} testID={`goal-${g.slug}`} />)}
        </View>

        <Text style={s.section}>{t.onboarding.experienceQ}</Text>
        <View style={s.wrapRow}>
          {(meta.data?.experience ?? []).map((e: any) => <Chip key={e.slug} label={e.label} active={f.experience === e.slug} onPress={() => set("experience", e.slug)} testID={`exp-${e.slug}`} />)}
        </View>

        <Text style={s.section}>{t.onboarding.daysQ}</Text>
        <View style={s.wrapRow}>
          {DAY_KEYS.map((d) => <Chip key={d} label={(t.days as any)[d]} active={f.training_days.includes(d)} onPress={() => toggle("training_days", f.training_days, d)} testID={`day-${d}`} />)}
        </View>

        <Text style={s.section}>{t.onboarding.durationQ}</Text>
        <View style={s.wrapRow}>
          {DURATIONS.map((d) => <Chip key={d} label={`${d} ${t.common.min}`} active={f.workout_duration_min === d} onPress={() => set("workout_duration_min", d)} testID={`dur-${d}`} />)}
        </View>

        <Text style={s.section}>{t.onboarding.equipmentQ}</Text>
        <View style={s.wrapRow}>
          {(meta.data?.equipment ?? []).map((e: any) => <Chip key={e.slug} label={e.label} active={f.equipment.includes(e.slug)} onPress={() => toggle("equipment", f.equipment, e.slug)} testID={`equip-${e.slug}`} />)}
        </View>
      </KeyboardAwareScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title={t.common.save} onPress={save} loading={saving} testID="save-settings" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { padding: spacing.lg, gap: spacing.sm },
  label: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600", marginBottom: spacing.xs },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, height: 50, paddingHorizontal: spacing.lg, color: c.onSurface, fontFamily: font.text, fontSize: font.base },
  row: { flexDirection: "row", gap: spacing.md },
  numWrap: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  numInput: { flex: 1, height: 50, color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg },
  unit: { color: c.muted, fontFamily: font.text },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.md },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
}));
