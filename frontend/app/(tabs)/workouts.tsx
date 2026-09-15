import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Lightning, Plus, Sparkle } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Segmented, Skeleton, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Workouts() {
  const { t, lang, user } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const [tab, setTab] = useState("mine");
  const [busy, setBusy] = useState(false);

  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get("/plans") });
  const templates = useQuery({ queryKey: ["templates", lang], queryFn: () => api.get("/plans/templates", { lang }) });

  const generate = async () => {
    setBusy(true);
    try {
      const p = await api.post("/plans/generate", {
        goal: user?.goal ?? "build_muscle", experience: user?.experience ?? "beginner",
        days_per_week: user?.training_days?.length || 3, workout_duration_min: user?.workout_duration_min ?? 60,
      }, { lang } as any);
      await qc.invalidateQueries({ queryKey: ["plans"] });
      toast.show(t.plans.generate, "success");
      router.push(`/builder/${p.id}`);
    } catch { toast.show(t.errors.generic, "error"); } finally { setBusy(false); }
  };

  const applyTemplate = async (id: string) => {
    setBusy(true);
    try {
      const p = await api.post(`/plans/from-template/${id}?lang=${lang}`);
      await qc.invalidateQueries({ queryKey: ["plans"] });
      router.push(`/builder/${p.id}`);
    } catch { toast.show(t.errors.generic, "error"); } finally { setBusy(false); }
  };

  const newPlan = async () => {
    const p = await api.post("/plans", { name: t.plans.newPlan, days: [{ name: `${t.plans.day} 1`, exercises: [] }] });
    await qc.invalidateQueries({ queryKey: ["plans"] });
    router.push(`/builder/${p.id}`);
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Display size={font["2xl"]}>{t.plans.title}</Display>
        <Segmented value={tab} onChange={setTab} testID="plans-seg"
          options={[{ key: "mine", label: t.plans.myPlans }, { key: "templates", label: t.plans.templates }]} />
      </View>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {tab === "mine" ? (
          <>
            <View style={s.actions}>
              <Pressable style={s.action} onPress={generate} testID="generate-plan">
                <Sparkle color={colors.brandPrimary} size={22} weight="fill" />
                <Text style={s.actionText}>{t.plans.generate}</Text>
                <Body muted size={font.sm}>{t.plans.generateDesc}</Body>
              </Pressable>
              <Pressable style={s.action} onPress={newPlan} testID="new-plan">
                <Plus color={colors.success} size={22} weight="bold" />
                <Text style={s.actionText}>{t.plans.newPlan}</Text>
                <Body muted size={font.sm}>{t.plans.builder}</Body>
              </Pressable>
            </View>
            {plans.isLoading ? <Skeleton height={80} /> :
              (plans.data?.items ?? []).length === 0 ? (
                <EmptyState title={t.dashboard.noPlans} testID="empty-plans"
                  action={<Button title={t.plans.generate} onPress={generate} loading={busy} testID="empty-generate" />} />
              ) : (
                plans.data.items.map((p: any) => (
                  <Pressable key={p.id} onPress={() => router.push(`/builder/${p.id}`)} testID={`plan-item-${p.id}`}>
                    <Card style={s.planCard}>
                      <View style={{ flex: 1 }}>
                        <View style={s.planTitleRow}>
                          <Body style={{ fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{p.name}</Body>
                          {p.generated ? <Lightning color={colors.brandPrimary} size={16} weight="fill" /> : null}
                        </View>
                        <Body muted size={font.sm}>{p.days?.length ?? 0} {t.plans.day} · {p.tags?.join(" · ")}</Body>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
          </>
        ) : (
          templates.isLoading ? <Skeleton height={80} /> :
            (templates.data?.items ?? []).map((tpl: any) => (
              <Card key={tpl.id} style={{ gap: spacing.sm }} testID={`template-${tpl.id}`}>
                <Body style={{ fontWeight: "700", fontSize: font.lg }}>{tpl.name}</Body>
                <Body muted size={font.sm}>{tpl.description}</Body>
                <View style={s.tagRow}>
                  <View style={s.tag}><Text style={s.tagText}>{tpl.days_per_week} {t.plans.daysPerWeek}</Text></View>
                  {tpl.tags?.slice(0, 2).map((tg: string) => <View key={tg} style={s.tag}><Text style={s.tagText}>{tg}</Text></View>)}
                </View>
                <Button title={t.common.add} small onPress={() => applyTemplate(tpl.id)} loading={busy} testID={`use-template-${tpl.id}`} />
              </Card>
            ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.md },
  action: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs, borderWidth: 1, borderColor: c.border },
  actionText: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg },
  planCard: { flexDirection: "row", alignItems: "center" },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tagRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  tag: { backgroundColor: c.brandTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText: { color: c.onBrandTertiary, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
}));
