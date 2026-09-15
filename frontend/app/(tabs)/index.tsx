import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Barbell, CaretRight, Fire, ForkKnife, Lightning, Trophy } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Skeleton } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function Dashboard() {
  const { user, t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();

  const week = useQuery({ queryKey: ["week"], queryFn: () => api.get("/week") });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get("/plans") });
  const recent = useQuery({ queryKey: ["sessions"], queryFn: () => api.get("/sessions", { limit: 5 }) });
  const game = useQuery({ queryKey: ["gamification"], queryFn: () => api.get("/gamification") });

  const startEmpty = async () => {
    await api.post("/sessions/start", { name: t.dashboard.startEmpty, exercises: [] });
    router.push("/workout/active");
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg, paddingBottom: spacing["3xl"] }]} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <View>
            <Body muted size={font.base}>{t.dashboard.hello},</Body>
            <Display size={font["2xl"]}>{user?.name}</Display>
          </View>
          <Pressable style={s.levelBadge} onPress={() => router.push("/leaderboard")} testID="level-badge">
            <Lightning color={colors.brandPrimary} size={16} weight="fill" />
            <Text style={s.levelText}>{t.dashboard.level} {game.data?.level ?? user?.level ?? 1}</Text>
          </Pressable>
        </View>

        {/* Streak + XP row */}
        <View style={s.statRow}>
          <View style={s.miniStat}>
            <Fire color={colors.brandPrimary} size={22} weight="fill" />
            <Text style={s.miniVal}>{game.data?.streak ?? 0}</Text>
            <Text style={s.miniLabel}>{t.dashboard.streak}</Text>
          </View>
          <View style={s.miniStat}>
            <Trophy color={colors.warning} size={22} weight="fill" />
            <Text style={s.miniVal}>{game.data?.xp ?? 0}</Text>
            <Text style={s.miniLabel}>XP</Text>
          </View>
          <View style={s.miniStat}>
            <Barbell color={colors.success} size={22} weight="fill" />
            <Text style={s.miniVal}>{game.data?.total_workouts ?? 0}</Text>
            <Text style={s.miniLabel}>{t.dashboard.workouts}</Text>
          </View>
        </View>

        {/* Start CTA */}
        <Pressable onPress={startEmpty} testID="start-empty-workout">
          <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
            <View style={{ flex: 1 }}>
              <Text style={s.ctaTitle}>{t.dashboard.startEmpty}</Text>
              <Text style={s.ctaSub}>{t.dashboard.quickStart}</Text>
            </View>
            <View style={s.ctaIcon}><Barbell color={colors.onBrandPrimary} size={28} weight="fill" /></View>
          </LinearGradient>
        </Pressable>

        {/* Weekly strip */}
        <Text style={s.section}>{t.dashboard.thisWeek}</Text>
        <View style={s.weekRow}>
          {week.isLoading ? DAY_KEYS.map((d) => <Skeleton key={d} height={64} width={40} />) :
            (week.data?.days ?? []).map((d: any, i: number) => (
              <View key={d.date} style={[s.dayCol, d.completed > 0 && s.dayDone, d.planned && d.completed === 0 && s.dayPlanned]}>
                <Text style={[s.dayLabel, (d.completed > 0) && s.dayLabelActive]}>{(t.days as any)[DAY_KEYS[i]]}</Text>
                <View style={[s.dayDot, d.completed > 0 && s.dayDotDone, d.planned && d.completed === 0 && s.dayDotPlanned]} />
              </View>
            ))}
        </View>

        {/* Quick access */}
        <View style={s.quickRow}>
          <Pressable style={s.quick} onPress={() => router.push("/exercises")} testID="browse-exercises">
            <Barbell color={colors.brandPrimary} size={24} weight="fill" />
            <Text style={s.quickText}>{t.dashboard.browseExercises}</Text>
          </Pressable>
          <Pressable style={s.quick} onPress={() => router.push("/food")} testID="nutrition-card">
            <ForkKnife color={colors.success} size={24} weight="fill" />
            <Text style={s.quickText}>{t.dashboard.nutrition}</Text>
          </Pressable>
        </View>

        {/* My Plans */}
        <View style={s.sectionRow}>
          <Text style={s.section}>{t.dashboard.myPlans}</Text>
          <Pressable onPress={() => router.push("/(tabs)/workouts")}><CaretRight color={colors.muted} size={20} /></Pressable>
        </View>
        {plans.isLoading ? <Skeleton height={70} /> :
          (plans.data?.items ?? []).length === 0 ? (
            <Card><Body muted>{t.dashboard.noPlans}</Body>
              <Button title={t.plans.generate} small onPress={() => router.push("/(tabs)/workouts")} style={{ marginTop: spacing.md }} testID="dash-generate" />
            </Card>
          ) : (
            (plans.data.items).slice(0, 3).map((p: any) => (
              <Pressable key={p.id} onPress={() => router.push(`/builder/${p.id}`)} testID={`plan-${p.id}`}>
                <Card style={s.planCard}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: "700" }}>{p.name}</Body>
                    <Body muted size={font.sm}>{p.days?.length ?? 0} {t.plans.day}</Body>
                  </View>
                  <CaretRight color={colors.muted} size={18} />
                </Card>
              </Pressable>
            ))
          )}

        {/* Recent */}
        <Text style={s.section}>{t.dashboard.recent}</Text>
        {recent.isLoading ? <Skeleton height={70} /> :
          (recent.data?.items ?? []).length === 0 ? (
            <EmptyState title={t.dashboard.noRecent} subtitle={t.dashboard.startFirst} testID="empty-recent" />
          ) : (
            (recent.data.items).map((sess: any) => (
              <Card key={sess.id} style={s.planCard}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }} numberOfLines={1}>{sess.name}</Body>
                  <Body muted size={font.sm}>{sess.total_sets} {t.plans.sets} · {Math.round(sess.total_volume)} kg · {Math.round((sess.duration_sec || 0) / 60)} {t.common.min}</Body>
                </View>
              </Card>
            ))
          )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.surfaceSecondary, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
  levelText: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.base },
  statRow: { flexDirection: "row", gap: spacing.sm },
  miniStat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 2, borderWidth: 1, borderColor: c.border },
  miniVal: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.xl },
  miniLabel: { color: c.muted, fontFamily: font.text, fontSize: 10, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  ctaTitle: { color: c.onBrandPrimary, fontFamily: font.display, fontWeight: "700", fontSize: font.xl },
  ctaSub: { color: c.onBrandPrimary, fontFamily: font.text, opacity: 0.85, fontSize: font.sm },
  ctaIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.sm },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  weekRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  dayCol: { alignItems: "center", gap: spacing.sm, flex: 1 },
  dayDone: {}, dayPlanned: {},
  dayLabel: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
  dayLabelActive: { color: c.onSurface },
  dayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary },
  dayDotDone: { backgroundColor: c.brandPrimary },
  dayDotPlanned: { borderWidth: 2, borderColor: c.brandSecondary, backgroundColor: "transparent" },
  quickRow: { flexDirection: "row", gap: spacing.md },
  quick: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: c.border },
  quickText: { color: c.onSurface, fontFamily: font.text, fontWeight: "700", fontSize: font.base },
  planCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
}));
