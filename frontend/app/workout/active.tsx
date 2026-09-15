import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, Play, Plus, Trash, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, useToast } from "@/src/components/ui";
import { pickStore } from "@/src/pickStore";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type SetT = { reps: number; weight: number; done: boolean; warmup?: boolean };
type ExT = { exercise_id: string; name: string; primary_muscle?: string; rest: number; sets: SetT[]; notes?: string };

export default function ActiveWorkout() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();

  const [session, setSession] = useState<any>(null);
  const [exs, setExs] = useState<ExT[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    api.get("/sessions/active").then((sess) => {
      if (!sess || !sess.id) { router.replace("/(tabs)"); return; }
      setSession(sess);
      setExs(sess.exercises ?? []);
      // Plan-based workouts start immediately; free/empty workouts wait for Start.
      if (sess.plan_id) { setStarted(true); startRef.current = new Date(sess.started_at).getTime(); }
    });
  }, [router]);

  useEffect(() => {
    if (!started) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [started]);

  useEffect(() => {
    if (rest == null) return;
    if (rest <= 0) { setRest(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); return; }
    const to = setTimeout(() => setRest((r) => (r == null ? null : r - 1)), 1000);
    return () => clearTimeout(to);
  }, [rest]);

  const persist = (next: ExT[]) => {
    setExs(next);
    if (session) api.put(`/sessions/${session.id}`, { exercises: next }).catch(() => {});
  };

  const toggleSet = (ei: number, si: number) => {
    const next = exs.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((st, j) => j !== si ? st : { ...st, done: !st.done }) });
    const nowDone = next[ei].sets[si].done;
    persist(next);
    if (nowDone && started) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setRest(exs[ei].rest || 90); }
  };

  const setRestFor = (ei: number, val: number) =>
    persist(exs.map((e, i) => i !== ei ? e : { ...e, rest: Math.max(0, val) }));

  const beginWorkout = () => { setStarted(true); startRef.current = Date.now(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); };

  const editSet = (ei: number, si: number, key: "reps" | "weight", val: string) => {
    const num = parseFloat(val) || 0;
    persist(exs.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((st, j) => j !== si ? st : { ...st, [key]: num }) }));
  };

  const addSet = (ei: number) => {
    const last = exs[ei].sets[exs[ei].sets.length - 1];
    persist(exs.map((e, i) => i !== ei ? e : { ...e, sets: [...e.sets, { reps: last?.reps ?? 10, weight: last?.weight ?? 0, done: false }] }));
  };
  const removeSet = (ei: number, si: number) =>
    persist(exs.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }));

  const finish = async () => {
    const res = await api.post(`/sessions/${session.id}/finish`, { exercises: exs });
    await qc.invalidateQueries();
    setSummary(res);
  };

  const cancel = async () => {
    await api.post(`/sessions/${session.id}/cancel`, {});
    await qc.invalidateQueries();
    router.replace("/(tabs)");
  };

  const addExercise = () => {
    pickStore.request((picked) => {
      const ex: ExT = { exercise_id: picked.id, name: picked.name, primary_muscle: picked.primary_muscle, rest: 90,
        sets: [{ reps: 10, weight: 0, done: false }] };
      setExs((prev) => {
        const next = [...prev, ex];
        if (session) api.put(`/sessions/${session.id}`, { exercises: next }).catch(() => {});
        return next;
      });
    });
    router.push("/exercises?pick=1");
  };

  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Display size={font.lg} numberOfLines={1}>{session?.name ?? t.workout.active}</Display>
          <Text style={s.timer}>{started ? fmt(elapsed) : t.common.start}</Text>
        </View>
        <Pressable onPress={() => setCancelModal(true)} hitSlop={10} testID="cancel-workout"><X color={colors.error} size={26} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {exs.length === 0 ? (
          <Card><Body muted>{t.plans.emptyBuilder}</Body></Card>
        ) : exs.map((ex, ei) => (
          <Card key={ei} style={{ gap: spacing.sm }} testID={`active-ex-${ei}`}>
            <Body style={{ fontWeight: "700", fontSize: font.lg }}>{ex.name}</Body>
            <View style={s.restCtl}>
              <Text style={s.restCtlLabel}>{t.plans.rest}</Text>
              <Pressable style={s.restStep} onPress={() => setRestFor(ei, (ex.rest || 90) - 15)} testID={`rest-minus-${ei}`}><Text style={s.restStepText}>−15</Text></Pressable>
              <Text style={s.restVal}>{ex.rest || 90}s</Text>
              <Pressable style={s.restStep} onPress={() => setRestFor(ei, (ex.rest || 90) + 15)} testID={`rest-plus-${ei}`}><Text style={s.restStepText}>+15</Text></Pressable>
            </View>
            <View style={s.setHead}>
              <Text style={[s.col, { flex: 0.6 }]}>{t.workout.set}</Text>
              <Text style={[s.col, { flex: 1 }]}>{t.plans.weight}</Text>
              <Text style={[s.col, { flex: 1 }]}>{t.plans.reps}</Text>
              <Text style={[s.col, { flex: 0.8 }]}>✓</Text>
            </View>
            {ex.sets.map((st, si) => (
              <View key={si} style={[s.setRow, st.done && s.setDone]}>
                <Text style={[s.col, { flex: 0.6 }]}>{si + 1}</Text>
                <TextInput style={[s.setInput, { flex: 1 }]} value={String(st.weight)} keyboardType="decimal-pad"
                  onChangeText={(v) => editSet(ei, si, "weight", v)} testID={`set-weight-${ei}-${si}`} />
                <TextInput style={[s.setInput, { flex: 1 }]} value={String(st.reps)} keyboardType="number-pad"
                  onChangeText={(v) => editSet(ei, si, "reps", v)} testID={`set-reps-${ei}-${si}`} />
                <Pressable style={[s.check, st.done && s.checkOn]} onPress={() => toggleSet(ei, si)} testID={`set-done-${ei}-${si}`}>
                  {st.done ? <Check color={colors.onBrandPrimary} size={18} weight="bold" /> : null}
                </Pressable>
                <Pressable onPress={() => removeSet(ei, si)} hitSlop={8} style={{ paddingLeft: spacing.xs }} testID={`set-remove-${ei}-${si}`}><Trash color={colors.muted} size={16} /></Pressable>
              </View>
            ))}
            <Pressable style={s.addSet} onPress={() => addSet(ei)} testID={`add-set-${ei}`}>
              <Plus color={colors.brandPrimary} size={16} weight="bold" /><Text style={s.addSetText}>{t.workout.addSet}</Text>
            </Pressable>
          </Card>
        ))}
        <Button title={t.plans.addExercise} variant="secondary" onPress={addExercise} testID="active-add-exercise"
          icon={<Plus color={colors.onSurfaceTertiary} size={18} weight="bold" />} />
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {started ? (
          <Button title={t.workout.finishWorkout} onPress={finish} testID="finish-workout" />
        ) : (
          <Button title={t.common.start} onPress={beginWorkout} disabled={exs.length === 0} testID="start-free-workout"
            icon={<Play color={colors.onBrandPrimary} size={18} weight="fill" />} />
        )}
      </View>

      {/* Rest timer overlay */}
      {rest != null ? (
        <View style={s.restOverlay} testID="rest-overlay">
          <LinearGradient colors={[colors.surfaceTertiary, colors.brandTertiary]} style={s.restGrad}>
            <Text style={s.restLabel}>{t.workout.rest}</Text>
            <Text style={s.restTime}>{fmt(rest)}</Text>
            <View style={s.restBtns}>
              <Button title={t.workout.addTime} variant="secondary" small onPress={() => setRest((r) => (r ?? 0) + 15)} testID="rest-add" />
              <Button title={t.workout.skipRest} small onPress={() => setRest(null)} testID="rest-skip" />
            </View>
          </LinearGradient>
        </View>
      ) : null}

      {/* Cancel modal */}
      <Modal visible={cancelModal} transparent animationType="fade" onRequestClose={() => setCancelModal(false)}>
        <Pressable style={s.modalBg} onPress={() => setCancelModal(false)}>
          <Pressable style={s.modal} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.workout.cancelWorkout}</Display>
            <Body muted>{t.workout.cancelConfirm}</Body>
            <Button title={t.workout.cancelWorkout} variant="danger" onPress={cancel} testID="confirm-cancel" />
            <Button title={t.common.continue} variant="ghost" onPress={() => setCancelModal(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Summary modal */}
      <Modal visible={!!summary} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Display size={font["2xl"]} style={{ color: colors.brandPrimary }}>{t.workout.summary}</Display>
            <View style={s.sumRow}>
              <View style={s.sumStat}><Text style={s.sumVal}>+{summary?.xp_gained}</Text><Text style={s.sumLabel}>{t.workout.xpGained}</Text></View>
              <View style={s.sumStat}><Text style={s.sumVal}>{Math.round(summary?.total_volume ?? 0)}</Text><Text style={s.sumLabel}>{t.workout.totalVolume} kg</Text></View>
              <View style={s.sumStat}><Text style={s.sumVal}>{summary?.total_sets}</Text><Text style={s.sumLabel}>{t.plans.sets}</Text></View>
            </View>
            {summary?.prs?.length ? <Body style={{ color: colors.success, fontWeight: "700" }}>🏆 {summary.prs.length} {t.workout.newPr}</Body> : null}
            {summary?.new_achievements?.length ? <Body style={{ color: colors.warning }}>🎖️ {summary.new_achievements.map((a: string) => (t.gamification as any)[a] ?? a).join(", ")}</Body> : null}
            <Button title={t.common.done} onPress={() => { setSummary(null); router.replace("/(tabs)"); }} testID="summary-done" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  timer: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.brandPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  setHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  restCtl: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  restCtlLabel: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600", flex: 1 },
  restStep: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary },
  restStepText: { color: c.brandPrimary, fontFamily: font.text, fontWeight: "700", fontSize: font.sm },
  restVal: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.base, minWidth: 46, textAlign: "center" },
  col: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600", textAlign: "center" },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  setDone: { opacity: 0.6 },
  setInput: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, height: 44, textAlign: "center", color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg },
  check: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  addSet: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  addSetText: { color: c.brandPrimary, fontFamily: font.text, fontWeight: "700" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  restOverlay: { ...({ position: "absolute" } as const), top: 0, bottom: 0, left: 0, right: 0 },
  restGrad: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  restLabel: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface, letterSpacing: 4 },
  restTime: { fontFamily: font.display, fontWeight: "700", fontSize: 96, color: c.brandPrimary },
  restBtns: { flexDirection: "row", gap: spacing.md },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: spacing.xl },
  modal: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: c.border },
  sumRow: { flexDirection: "row", gap: spacing.sm },
  sumStat: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  sumVal: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface },
  sumLabel: { fontFamily: font.text, fontSize: 11, color: c.muted, textAlign: "center" },
}));
