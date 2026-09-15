import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, Copy, DotsSixVertical, Play, Plus, Trash } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Segmented, Skeleton, useToast } from "@/src/components/ui";
import { pickStore } from "@/src/pickStore";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type PEx = { exercise_id: string; name: string; primary_muscle?: string; sets: number; reps: number; weight: number; rest: number; rpe?: number | null; notes?: string; warmup?: boolean; dropset?: boolean };
type Day = { name: string; exercises: PEx[] };

export default function Builder() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["plan", id], queryFn: () => api.get(`/plans/${id}`) });
  const [name, setName] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [renameModal, setRenameModal] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data) { setName(q.data.name); setDays(q.data.days ?? []); }
  }, [q.data]);

  const save = async (silent = false) => {
    await api.put(`/plans/${id}`, { name, description: q.data?.description ?? "", days, tags: q.data?.tags ?? [] });
    await qc.invalidateQueries({ queryKey: ["plans"] });
    setDirty(false);
    if (!silent) toast.show(t.plans.savePlan, "success");
  };

  const addDay = () => { setDays([...days, { name: `${t.plans.day} ${days.length + 1}`, exercises: [] }]); setDayIdx(days.length); setDirty(true); };
  const removeDay = (i: number) => { const nd = days.filter((_, j) => j !== i); setDays(nd); setDayIdx(Math.max(0, i - 1)); setDirty(true); };

  const addExercise = () => {
    pickStore.request((picked) => {
      setDays((prev) => prev.map((d, i) => i !== dayIdx ? d : { ...d, exercises: [...d.exercises, { exercise_id: picked.id, name: picked.name, primary_muscle: picked.primary_muscle, sets: 3, reps: 10, weight: 0, rest: 90 }] }));
      setDirty(true);
    });
    router.push("/exercises?pick=1");
  };

  const editEx = (exi: number, key: keyof PEx, val: any) => {
    setDays((prev) => prev.map((d, i) => i !== dayIdx ? d : { ...d, exercises: d.exercises.map((e, j) => j !== exi ? e : { ...e, [key]: val }) }));
    setDirty(true);
  };
  const removeEx = (exi: number) => {
    setDays((prev) => prev.map((d, i) => i !== dayIdx ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== exi) }));
    setDirty(true);
  };

  const startWorkout = async () => {
    if (dirty) await save(true);
    await api.post("/sessions/start", { plan_id: id, day_index: dayIdx, name: `${name} · ${days[dayIdx]?.name}` });
    router.push("/workout/active");
  };

  const duplicate = async () => { const p = await api.post(`/plans/${id}/duplicate`, {}); await qc.invalidateQueries({ queryKey: ["plans"] }); router.replace(`/builder/${p.id}`); };
  const del = async () => { await api.del(`/plans/${id}`); await qc.invalidateQueries({ queryKey: ["plans"] }); router.back(); };

  const day = days[dayIdx];

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={async () => { if (dirty) await save(true); router.back(); }} hitSlop={10} testID="builder-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => setRenameModal(true)} testID="builder-rename"><Display size={font.lg} numberOfLines={1}>{name}</Display></Pressable>
        <Pressable onPress={duplicate} hitSlop={10} style={{ paddingHorizontal: spacing.xs }} testID="builder-duplicate"><Copy color={colors.muted} size={22} /></Pressable>
        <Pressable onPress={del} hitSlop={10} testID="builder-delete"><Trash color={colors.error} size={22} /></Pressable>
      </View>

      {q.isLoading ? <View style={{ padding: spacing.lg }}><Skeleton height={200} /></View> : (
        <>
          {/* Day tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayTabs} style={{ maxHeight: 56 }}>
            {days.map((d, i) => (
              <Pressable key={i} style={[s.dayTab, dayIdx === i && s.dayTabActive]} onPress={() => setDayIdx(i)} testID={`day-tab-${i}`}>
                <Text style={[s.dayTabText, dayIdx === i && s.dayTabTextActive]}>{d.name}</Text>
              </Pressable>
            ))}
            <Pressable style={s.dayAdd} onPress={addDay} testID="add-day"><Plus color={colors.brandPrimary} size={18} weight="bold" /></Pressable>
          </ScrollView>

          {day ? (
            <DraggableFlatList
              data={day.exercises}
              keyExtractor={(_, i) => `${dayIdx}-${i}`}
              onDragEnd={({ data }) => { setDays((prev) => prev.map((d, i) => i !== dayIdx ? d : { ...d, exercises: data })); setDirty(true); }}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 160, gap: spacing.md }}
              ListEmptyComponent={<EmptyState title={t.plans.emptyBuilder} testID="builder-empty" />}
              ListFooterComponent={
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                  <Button title={t.plans.addExercise} variant="secondary" onPress={addExercise} testID="builder-add-exercise" icon={<Plus color={colors.onSurfaceTertiary} size={18} weight="bold" />} />
                  {days.length > 1 ? <Button title={`${t.common.remove} ${day.name}`} variant="ghost" onPress={() => removeDay(dayIdx)} testID="remove-day" /> : null}
                </View>
              }
              renderItem={({ item, drag, getIndex }) => {
                const exi = getIndex() ?? 0;
                return (
                  <Card style={{ gap: spacing.sm }} testID={`builder-ex-${exi}`}>
                    <View style={s.exHead}>
                      <Pressable onLongPress={drag} hitSlop={8} testID={`drag-${exi}`}><DotsSixVertical color={colors.muted} size={22} /></Pressable>
                      <Body style={{ flex: 1, fontWeight: "700" }} numberOfLines={1}>{item.name}</Body>
                      <Pressable onPress={() => removeEx(exi)} hitSlop={8} testID={`remove-ex-${exi}`}><Trash color={colors.error} size={18} /></Pressable>
                    </View>
                    <View style={s.cfgRow}>
                      {([["sets", t.plans.sets], ["reps", t.plans.reps], ["weight", t.plans.weight], ["rest", t.plans.rest]] as const).map(([k, label]) => (
                        <View key={k} style={s.cfg}>
                          <Text style={s.cfgLabel}>{label}</Text>
                          <TextInput style={s.cfgInput} value={String((item as any)[k])} keyboardType="numeric"
                            onChangeText={(v) => editEx(exi, k as keyof PEx, parseFloat(v) || 0)} testID={`cfg-${k}-${exi}`} />
                        </View>
                      ))}
                    </View>
                    <View style={s.tagRow}>
                      <Pressable style={[s.miniTag, item.warmup && s.miniTagOn]} onPress={() => editEx(exi, "warmup", !item.warmup)} testID={`warmup-${exi}`}><Text style={[s.miniTagText, item.warmup && s.miniTagTextOn]}>{t.plans.warmup}</Text></Pressable>
                      <Pressable style={[s.miniTag, item.dropset && s.miniTagOn]} onPress={() => editEx(exi, "dropset", !item.dropset)} testID={`dropset-${exi}`}><Text style={[s.miniTagText, item.dropset && s.miniTagTextOn]}>{t.plans.dropset}</Text></Pressable>
                    </View>
                  </Card>
                );
              }}
            />
          ) : null}
        </>
      )}

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title={t.common.save} variant="secondary" onPress={() => save()} style={{ flex: 1 }} testID="save-plan" />
        <Button title={t.plans.startWorkout} onPress={startWorkout} style={{ flex: 2 }} testID="start-plan-workout"
          icon={<Play color={colors.onBrandPrimary} size={18} weight="fill" />} />
      </View>

      <Modal visible={renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(false)}>
        <Pressable style={s.modalBg} onPress={() => setRenameModal(false)}>
          <Pressable style={s.modal} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.plans.rename ?? t.common.rename}</Display>
            <TextInput style={s.renameInput} value={name} onChangeText={(v) => { setName(v); setDirty(true); }} autoFocus testID="rename-input" />
            <Button title={t.common.done} onPress={() => setRenameModal(false)} testID="rename-done" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  dayTabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 },
  dayTab: { height: 40, flexShrink: 0, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dayTabActive: { backgroundColor: c.brandPrimary },
  dayTabText: { color: c.onSurfaceTertiary, fontFamily: font.text, fontWeight: "600" },
  dayTabTextActive: { color: c.onBrandPrimary },
  dayAdd: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  exHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cfgRow: { flexDirection: "row", gap: spacing.sm },
  cfg: { flex: 1, gap: 4 },
  cfgLabel: { color: c.muted, fontFamily: font.text, fontSize: 11, textAlign: "center" },
  cfgInput: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, height: 42, textAlign: "center", color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.base },
  tagRow: { flexDirection: "row", gap: spacing.sm },
  miniTag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary },
  miniTagOn: { backgroundColor: c.brandTertiary },
  miniTagText: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
  miniTagTextOn: { color: c.onBrandTertiary },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: spacing.md, padding: spacing.lg, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: spacing.xl },
  modal: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: c.border },
  renameInput: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, height: 52, paddingHorizontal: spacing.lg, color: c.onSurface, fontFamily: font.text, fontSize: font.lg },
}));
