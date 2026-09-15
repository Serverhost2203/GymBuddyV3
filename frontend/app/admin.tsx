import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { CaretLeft, ShieldCheck, ShieldSlash, Warning } from "phosphor-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, Segmented, Skeleton, StatCard, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Admin() {
  const { t, user } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const [tab, setTab] = useState("overview");

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => api.get("/admin/overview") });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api.get("/admin/users"), enabled: tab === "users" });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => api.get("/admin/audit"), enabled: tab === "audit" });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: () => api.get("/admin/reports"), enabled: tab === "reports" });

  const changeRole = async (uid: string, action: "promote" | "demote") => {
    try { await api.patch(`/admin/users/${uid}/role`, { action }); await qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.show(t.common.done, "success"); }
    catch (e: any) { toast.show(action === "demote" ? t.admin.onlyRootDemote : t.errors.generic, "error"); }
  };
  const toggleDisable = async (uid: string) => {
    try { await api.patch(`/admin/users/${uid}/disable`, {}); await qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    catch { toast.show(t.errors.generic, "error"); }
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <CaretLeft color={colors.onSurface} size={26} onPress={() => router.back()} testID="admin-back" />
        <Display size={font.xl} style={{ flex: 1 }}>{t.admin.title}</Display>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Segmented value={tab} onChange={setTab} testID="admin-seg"
          options={[{ key: "overview", label: t.admin.overview }, { key: "users", label: t.admin.users }, { key: "audit", label: t.admin.audit }, { key: "reports", label: t.admin.reports }]} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {tab === "overview" && (overview.isLoading ? <Skeleton height={100} /> : (
          <View style={s.statRow}>
            <StatCard label={t.admin.totalUsers} value={String(overview.data?.total_users ?? 0)} accent />
            <StatCard label={t.admin.totalExercises} value={String(overview.data?.total_exercises ?? 0)} />
            <StatCard label={t.admin.totalWorkouts} value={String(overview.data?.total_completed_workouts ?? 0)} />
          </View>
        ))}

        {tab === "users" && (users.isLoading ? <Skeleton height={80} /> :
          (users.data?.items ?? []).map((u: any) => (
            <Card key={u.id} style={{ gap: spacing.sm }} testID={`admin-user-${u.id}`}>
              <View style={s.userRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }}>{u.name} {u.root_admin ? "👑" : ""}</Body>
                  <Body muted size={font.sm}>{u.email} · {u.role}{u.deleted_at ? " · disabled" : ""}</Body>
                </View>
              </View>
              {!u.root_admin ? (
                <View style={s.userActions}>
                  {u.role === "admin" ? (
                    <Button title={t.admin.demote} small variant="ghost" onPress={() => changeRole(u.id, "demote")} testID={`demote-${u.id}`}
                      icon={<ShieldSlash color={colors.brandPrimary} size={16} />} />
                  ) : (
                    <Button title={t.admin.promote} small onPress={() => changeRole(u.id, "promote")} testID={`promote-${u.id}`}
                      icon={<ShieldCheck color={colors.onBrandPrimary} size={16} weight="fill" />} />
                  )}
                  <Button title={u.deleted_at ? t.admin.enable : t.admin.disable} small variant="secondary" onPress={() => toggleDisable(u.id)} testID={`disable-${u.id}`} />
                </View>
              ) : null}
            </Card>
          )))}

        {tab === "audit" && (audit.isLoading ? <Skeleton height={80} /> : (
          <View style={{ gap: spacing.md }}>
            {[
              [t.admin.noImage, audit.data?.exercises_without_image?.count],
              [t.admin.noDemo, audit.data?.exercises_without_demonstration?.count],
              [t.admin.invalidEquip, audit.data?.invalid_equipment_mappings?.count],
              [t.admin.missingTr, audit.data?.missing_translations?.count],
              [t.admin.duplicates, audit.data?.duplicate_exercises?.count],
            ].map(([label, count]: any, i) => (
              <Card key={i} style={s.auditRow} testID={`audit-${i}`}>
                <Warning color={(count ?? 0) > 0 ? colors.warning : colors.success} size={22} weight="fill" />
                <Body style={{ flex: 1, fontWeight: "600" }}>{label}</Body>
                <Text style={s.auditCount}>{count ?? 0}</Text>
              </Card>
            ))}
            <Body muted size={font.sm}>{t.admin.totalExercises}: {audit.data?.total_exercises}</Body>
          </View>
        ))}

        {tab === "reports" && (reports.isLoading ? <Skeleton height={80} /> : (
          <View style={{ gap: spacing.md }}>
            <Card>
              <Body style={{ fontWeight: "700", marginBottom: spacing.sm }}>{t.admin.totalExercises}</Body>
              {Object.entries(reports.data?.exercises_by_category ?? {}).map(([k, v]: any) => (
                <View key={k} style={s.reportRow}><Body muted>{k}</Body><Body style={{ fontWeight: "700" }}>{v}</Body></View>
              ))}
            </Card>
            <Card>
              <Body style={{ fontWeight: "700", marginBottom: spacing.sm }}>{t.admin.difficulty ?? "Difficulty"}</Body>
              {Object.entries(reports.data?.exercises_by_difficulty ?? {}).map(([k, v]: any) => (
                <View key={k} style={s.reportRow}><Body muted>{k}</Body><Body style={{ fontWeight: "700" }}>{v}</Body></View>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  statRow: { flexDirection: "row", gap: spacing.sm },
  userRow: { flexDirection: "row", alignItems: "center" },
  userActions: { flexDirection: "row", gap: spacing.sm },
  auditRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  auditCount: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface },
  reportRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
}));
