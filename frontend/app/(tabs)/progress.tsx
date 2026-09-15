import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Scales, TrendUp } from "phosphor-react-native";
import { useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Segmented, Skeleton, StatCard, useToast } from "@/src/components/ui";
import { BMIScale } from "@/src/components/BMIScale";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Progress() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const [tab, setTab] = useState("weight");
  const [modal, setModal] = useState(false);
  const [bmiOpen, setBmiOpen] = useState(false);
  const [w, setW] = useState("");

  const summary = useQuery({ queryKey: ["progress"], queryFn: () => api.get("/progress/summary") });
  const prs = useQuery({ queryKey: ["prs"], queryFn: () => api.get("/prs") });

  const logWeight = async () => {
    const val = parseFloat(w);
    if (!val || val < 30 || val > 300) return;
    await api.post("/measurements", { weight_kg: val });
    await qc.invalidateQueries({ queryKey: ["progress"] });
    setModal(false); setW("");
    toast.show(t.progress.logWeight, "success");
  };

  const d = summary.data;
  const chartW = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;

  const weightPts = (d?.weights ?? []).map((x: any) => ({ value: x.weight }));
  const volPts = (d?.volume_series ?? []).map((x: any) => ({ value: Math.round(x.volume) }));
  const freqPts = (d?.frequency ?? []).map((x: any) => ({ value: x.count }));
  const active = tab === "weight" ? weightPts : tab === "volume" ? volPts : freqPts;

  const bmiCatLabel = (cat?: string) => (cat ? (t.progress as any)[cat] ?? cat : "—");

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={s.headerRow}>
          <Display size={font["2xl"]}>{t.progress.title}</Display>
          <Pressable style={s.logBtn} onPress={() => setModal(true)} testID="log-weight">
            <Plus color={colors.onBrandPrimary} size={18} weight="bold" />
            <Text style={s.logText}>{t.progress.logWeight}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {summary.isLoading ? <Skeleton height={200} /> : (
          <>
            {/* BMI */}
            <Card>
              <View style={s.cardHead}><Scales color={colors.brandPrimary} size={20} weight="fill" /><Body style={{ fontWeight: "700" }}>{t.progress.bmi}</Body></View>
              {d?.bmi ? (
                <>
                  <Pressable onPress={() => setBmiOpen((v) => !v)} testID="bmi-toggle">
                    <View style={s.bmiRow}>
                      <Display size={font["3xl"]} style={{ color: colors.brandPrimary }}>{d.bmi}</Display>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: "700" }}>{bmiCatLabel(d.bmi_category)}</Body>
                        {d.bmi_range?.min_weight ? <Body muted size={font.sm}>{t.progress.bmiRange}: {d.bmi_range.min_weight}–{d.bmi_range.max_weight} kg</Body> : null}
                      </View>
                    </View>
                  </Pressable>
                  {bmiOpen ? <BMIScale bmi={d.bmi} categoryLabel={bmiCatLabel(d.bmi_category)} /> : null}
                  <Body muted size={font.sm} style={{ marginTop: spacing.sm }}>{t.progress.bmiDisclaimer}</Body>
                </>
              ) : <Body muted>{t.progress.noData}</Body>}
            </Card>

            {/* Goal estimation */}
            {d?.goal ? (
              <Card>
                <View style={s.cardHead}><TrendUp color={colors.success} size={20} weight="fill" /><Body style={{ fontWeight: "700" }}>{t.progress.target}</Body></View>
                <View style={s.statRow}>
                  <StatCard label={t.progress.current} value={`${d.goal.current} kg`} />
                  <StatCard label={t.progress.target} value={`${d.goal.target} kg`} accent />
                  <StatCard label={t.progress.difference} value={`${d.goal.difference > 0 ? "+" : ""}${d.goal.difference} kg`} />
                </View>
                {d.goal.trend_per_week != null ? (
                  <Body muted size={font.sm} style={{ marginTop: spacing.sm }}>
                    {t.progress.trend}: {d.goal.trend_per_week > 0 ? "+" : ""}{d.goal.trend_per_week} kg{t.progress.perWeek}
                    {d.goal.eta_weeks != null ? ` · ${t.progress.eta}: ~${d.goal.eta_weeks} ${t.progress.weeks}` : ""}
                  </Body>
                ) : null}
                <Body muted size={font.sm}>{t.progress.etaDisclaimer}</Body>
              </Card>
            ) : null}

            {/* Charts */}
            <Segmented value={tab} onChange={setTab} testID="progress-seg"
              options={[{ key: "weight", label: t.progress.bodyweight }, { key: "volume", label: t.progress.volume }, { key: "frequency", label: t.progress.frequency }]} />
            <Card>
              {active.length === 0 ? (
                <EmptyState title={t.progress.noData} testID="chart-empty" />
              ) : active.length === 1 ? (
                <View style={s.singlePoint}>
                  <Display size={font["3xl"]} style={{ color: colors.brandPrimary }}>{active[0].value}</Display>
                  <Body muted>{tab === "weight" ? "kg" : tab === "volume" ? "kg" : t.dashboard.workouts}</Body>
                </View>
              ) : (
                <LineChart
                  data={active}
                  width={chartW}
                  height={180}
                  thickness={3}
                  color={colors.brandPrimary}
                  startFillColor={colors.brandPrimary}
                  endFillColor={colors.surface}
                  startOpacity={0.4}
                  endOpacity={0.05}
                  areaChart
                  hideDataPoints={active.length > 15}
                  dataPointsColor={colors.brandPrimary}
                  yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                  xAxisColor={colors.border}
                  yAxisColor={colors.border}
                  rulesColor={colors.divider}
                  initialSpacing={10}
                  noOfSections={4}
                />
              )}
            </Card>

            {/* Streak + volume stats */}
            <View style={s.statRow}>
              <StatCard label={t.gamification.streak} value={String(d?.streak ?? 0)} accent />
              <StatCard label={t.gamification.best} value={String(d?.best_streak ?? 0)} />
              <StatCard label={t.progress.volume} value={`${Math.round((d?.total_volume ?? 0) / 1000)}k`} />
            </View>

            {/* PRs */}
            <Text style={s.section}>{t.progress.records}</Text>
            {prs.isLoading ? <Skeleton height={50} /> :
              (prs.data?.items ?? []).length === 0 ? <EmptyState title={t.progress.noRecords} testID="empty-prs" /> :
                prs.data.items.slice(0, 12).map((p: any) => (
                  <Card key={p.exercise_id} style={s.prRow}>
                    <Body style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>{p.name}</Body>
                    <Text style={s.prVal}>{p.weight} kg</Text>
                  </Card>
                ))}
          </>
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <Pressable style={s.overlay} onPress={() => setModal(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.progress.logWeight}</Display>
            <TextInput testID="weight-input" style={s.input} value={w} onChangeText={(v) => setW(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad" placeholder="75" placeholderTextColor={colors.muted} autoFocus />
            <Button title={t.common.save} onPress={logWeight} testID="save-weight" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.brandPrimary, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  logText: { color: c.onBrandPrimary, fontFamily: font.text, fontWeight: "700", fontSize: font.sm },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  bmiRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.sm },
  statRow: { flexDirection: "row", gap: spacing.sm },
  singlePoint: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.xs },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.sm },
  prRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  prVal: { color: c.brandPrimary, fontFamily: font.display, fontWeight: "700", fontSize: font.lg },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl },
  sheet: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: c.border },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 60, color: c.onSurface, fontSize: font["2xl"], fontFamily: font.display, fontWeight: "700" },
}));
