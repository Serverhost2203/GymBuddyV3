import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { CaretLeft, Lock, Medal } from "phosphor-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Card, Display, Skeleton, StatCard } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Achievements() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();

  const q = useQuery({ queryKey: ["gamification"], queryFn: () => api.get("/gamification") });
  const d = q.data;
  const earned = new Set(d?.achievements ?? []);
  const pct = d ? d.xp_into_level / d.xp_for_next : 0;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <CaretLeft color={colors.onSurface} size={26} onPress={() => router.back()} testID="ach-back" />
        <Display size={font.xl}>{t.gamification.title}</Display>
      </View>
      {q.isLoading || !d ? <View style={{ padding: spacing.lg }}><Skeleton height={140} /></View> : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={s.levelRow}>
              <Display size={font["4xl"]} style={{ color: colors.brandPrimary }}>{d.level}</Display>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }}>{t.gamification.level} {d.level}</Body>
                <View style={s.bar}><View style={[s.barFill, { width: `${Math.min(100, pct * 100)}%` }]} /></View>
                <Body muted size={font.sm}>{d.xp_into_level} / {d.xp_for_next} XP</Body>
              </View>
            </View>
          </Card>

          <View style={s.statRow}>
            <StatCard label={t.gamification.streak} value={String(d.streak)} accent />
            <StatCard label={t.gamification.best} value={String(d.best_streak)} />
            <StatCard label="XP" value={String(d.xp)} />
          </View>

          <Text style={s.section}>{t.gamification.challenges}</Text>
          {(d.challenges ?? []).map((ch: any) => (
            <Card key={ch.id} style={{ gap: spacing.sm }} testID={`challenge-${ch.id}`}>
              <Body style={{ fontWeight: "700" }}>{(t.gamification as any)[ch.id] ?? ch.id}</Body>
              <View style={s.bar}><View style={[s.barFill, { width: `${Math.min(100, (ch.progress / ch.target) * 100)}%` }]} /></View>
              <Body muted size={font.sm}>{ch.progress} / {ch.target}</Body>
            </Card>
          ))}

          <Text style={s.section}>{t.gamification.title}</Text>
          <View style={s.grid}>
            {(d.all_achievements ?? []).map((a: string) => {
              const has = earned.has(a);
              return (
                <View key={a} style={[s.badge, has && s.badgeOn]} testID={`achievement-${a}`}>
                  {has ? <Medal color={colors.brandPrimary} size={30} weight="fill" /> : <Lock color={colors.muted} size={26} />}
                  <Text style={[s.badgeText, has && s.badgeTextOn]}>{(t.gamification as any)[a] ?? a}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { padding: spacing.lg, gap: spacing.md },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  bar: { height: 8, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden", marginVertical: 6 },
  barFill: { height: 8, backgroundColor: c.brandPrimary, borderRadius: radius.pill },
  statRow: { flexDirection: "row", gap: spacing.sm },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: { width: "31%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: c.border, padding: spacing.sm },
  badgeOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  badgeText: { color: c.muted, fontFamily: font.text, fontSize: 10, textAlign: "center", fontWeight: "600" },
  badgeTextOn: { color: c.onBrandTertiary },
}));
