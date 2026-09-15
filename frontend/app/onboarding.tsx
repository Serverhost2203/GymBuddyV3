import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Display } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Meta = { equipment: { slug: string; label: string }[]; goals: { slug: string; label: string }[]; experience: { slug: string; label: string }[] };
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DURATIONS = [30, 45, 60, 75, 90];

export default function Onboarding() {
  const { user, t, lang, updateUser } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const { data: meta } = useQuery<Meta>({ queryKey: ["meta", lang], queryFn: () => api.get("/exercises/meta", { lang }) });

  const [form, setForm] = useState({
    name: user?.name ?? "", gender: "", date_of_birth: "",
    height_cm: "", weight_kg: "", target_weight_kg: "",
    goal: "", experience: "", training_days: [] as string[],
    workout_duration_min: 60, equipment: ["bodyweight"] as string[],
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const steps = useMemo(() => [
    { key: "name", valid: () => !!form.name.trim() },
    { key: "gender", valid: () => true },
    { key: "dob", valid: () => /^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth) || form.date_of_birth === "" },
    { key: "height", valid: () => +form.height_cm >= 100 && +form.height_cm <= 250 },
    { key: "weight", valid: () => +form.weight_kg >= 30 && +form.weight_kg <= 300 },
    { key: "target", valid: () => +form.target_weight_kg >= 30 && +form.target_weight_kg <= 300 },
    { key: "goal", valid: () => !!form.goal },
    { key: "experience", valid: () => !!form.experience },
    { key: "days", valid: () => form.training_days.length > 0 },
    { key: "duration", valid: () => !!form.workout_duration_min },
    { key: "equipment", valid: () => form.equipment.length > 0 },
  ], [form]);

  const cur = steps[step];
  const progress = (step + 1) / steps.length;

  const next = async () => {
    setErr("");
    if (!cur.valid()) return setErr(t.errors.fieldRequired);
    if (step < steps.length - 1) return setStep(step + 1);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        height_cm: +form.height_cm, weight_kg: +form.weight_kg,
        target_weight_kg: +form.target_weight_kg, goal: form.goal,
        experience: form.experience, training_days: form.training_days,
        workout_duration_min: form.workout_duration_min, equipment: form.equipment,
      };
      const updated = await api.post("/users/me/onboarding", payload);
      updateUser(updated);
      router.replace("/(tabs)");
    } catch {
      setErr(t.errors.generic);
      setSaving(false);
    }
  };

  const toggle = (key: string, arr: string[], v: string) =>
    set(key, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const numInput = (k: string, unit: string, ph: string) => (
    <View style={s.numWrap}>
      <TextInput testID={`ob-${k}`} style={s.numInput} value={(form as any)[k]} onChangeText={(v) => set(k, v.replace(/[^0-9.]/g, ""))}
        keyboardType="decimal-pad" placeholder={ph} placeholderTextColor={colors.muted} />
      <Text style={s.unit}>{unit}</Text>
    </View>
  );

  const optionGrid = (opts: { slug: string; label: string }[], selected: string | string[], k: string, multi = false) => (
    <View style={s.grid}>
      {opts.map((o) => {
        const active = multi ? (selected as string[]).includes(o.slug) : selected === o.slug;
        return (
          <Pressable key={o.slug} testID={`ob-opt-${o.slug}`}
            onPress={() => (multi ? toggle(k, selected as string[], o.slug) : set(k, o.slug))}
            style={[s.opt, active && s.optActive]}>
            <Text style={[s.optText, active && s.optTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderStep = () => {
    switch (cur.key) {
      case "name":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.nameQ}</Display>
          <TextInput testID="ob-name" style={s.textInput} value={form.name} onChangeText={(v) => set("name", v)} placeholder="Alex" placeholderTextColor={colors.muted} />
        </>);
      case "gender":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.genderQ}</Display>
          <Body muted>{t.common.optional}</Body>
          {optionGrid([
            { slug: "male", label: t.onboarding.male }, { slug: "female", label: t.onboarding.female },
            { slug: "other", label: t.onboarding.other }, { slug: "", label: t.onboarding.preferNot },
          ], form.gender, "gender")}
        </>);
      case "dob":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.dobQ}</Display>
          <Body muted>YYYY-MM-DD · {t.common.optional}</Body>
          <TextInput testID="ob-dob" style={s.textInput} value={form.date_of_birth} onChangeText={(v) => set("date_of_birth", v)} placeholder="1998-05-20" placeholderTextColor={colors.muted} />
        </>);
      case "height":
        return (<><Display size={font["2xl"]}>{t.onboarding.heightQ}</Display>{numInput("height_cm", "cm", "175")}</>);
      case "weight":
        return (<><Display size={font["2xl"]}>{t.onboarding.weightQ}</Display>{numInput("weight_kg", "kg", "75")}</>);
      case "target":
        return (<><Display size={font["2xl"]}>{t.onboarding.targetQ}</Display>{numInput("target_weight_kg", "kg", "72")}</>);
      case "goal":
        return (<><Display size={font["2xl"]}>{t.onboarding.goalQ}</Display>{optionGrid(meta?.goals ?? [], form.goal, "goal")}</>);
      case "experience":
        return (<><Display size={font["2xl"]}>{t.onboarding.experienceQ}</Display>{optionGrid(meta?.experience ?? [], form.experience, "experience")}</>);
      case "days":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.daysQ}</Display>
          <Body muted>{t.onboarding.selectDays}</Body>
          {optionGrid(DAY_KEYS.map((d) => ({ slug: d, label: (t.days as any)[d] })), form.training_days, "training_days", true)}
        </>);
      case "duration":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.durationQ}</Display>
          {optionGrid(DURATIONS.map((d) => ({ slug: String(d), label: `${d} ${t.common.min}` })), String(form.workout_duration_min), "workout_duration_min_str", false)}
          <View style={{ height: 0 }} />
        </>);
      case "equipment":
        return (<>
          <Display size={font["2xl"]}>{t.onboarding.equipmentQ}</Display>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {optionGrid(meta?.equipment ?? [], form.equipment, "equipment", true)}
          </ScrollView>
        </>);
    }
  };

  // handle duration virtual key
  const patchedNext = () => {
    if (cur.key === "duration") return next();
    next();
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.stepText}>{t.onboarding.step} {step + 1} / {steps.length}</Text>
        <View style={s.bar}><View style={[s.barFill, { width: `${progress * 100}%` }]} /></View>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={20} keyboardShouldPersistTaps="handled">
        {cur.key === "duration"
          ? (<>
              <Display size={font["2xl"]}>{t.onboarding.durationQ}</Display>
              <View style={s.grid}>
                {DURATIONS.map((d) => {
                  const active = form.workout_duration_min === d;
                  return (
                    <Pressable key={d} testID={`ob-dur-${d}`} onPress={() => set("workout_duration_min", d)} style={[s.opt, active && s.optActive]}>
                      <Text style={[s.optText, active && s.optTextActive]}>{d} {t.common.min}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>)
          : renderStep()}
        {err ? <Text style={s.err}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 ? <Button title={t.common.back} variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} testID="ob-back" /> : null}
        <Button title={step === steps.length - 1 ? t.onboarding.finishSetup : t.common.next} onPress={patchedNext} loading={saving} style={{ flex: 2 }} testID="ob-next" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  stepText: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
  bar: { height: 6, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: c.brandPrimary, borderRadius: radius.pill },
  content: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  textInput: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 56, color: c.onSurface, fontSize: font.xl, borderWidth: 1, borderColor: c.border, marginTop: spacing.md, fontFamily: font.text },
  numWrap: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  numInput: { flex: 1, height: 64, color: c.onSurface, fontSize: font["2xl"], fontFamily: font.display, fontWeight: "700" },
  unit: { color: c.muted, fontSize: font.xl, fontFamily: font.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  opt: { paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  optActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  optText: { color: c.onSurfaceSecondary, fontFamily: font.text, fontWeight: "600", fontSize: font.base },
  optTextActive: { color: c.onBrandPrimary },
  err: { color: c.error, fontFamily: font.text, marginTop: spacing.sm },
  footer: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border },
}));
