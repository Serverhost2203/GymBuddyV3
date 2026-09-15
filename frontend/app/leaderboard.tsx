import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { CaretLeft, Trophy } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Segmented, Skeleton } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Leaderboard() {
  const { t, user, updateUser } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [metric, setMetric] = useState("xp");

  const q = useQuery({ queryKey: ["leaderboard", metric, user?.leaderboard_optin], queryFn: () => api.get("/leaderboard", { metric }) });

  const optin = async () => { updateUser({ leaderboard_optin: true } as any); await api.put("/users/me/leaderboard-optin", { optin: true }); q.refetch(); };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="lb-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <Display size={font.xl}>{t.leaderboard.title}</Display>
      </View>

      {!user?.leaderboard_optin ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState icon={<Trophy color={colors.brandPrimary} size={48} weight="fill" />} title={t.leaderboard.title} subtitle={t.leaderboard.optinPrompt}
            action={<Button title={t.leaderboard.joinNow} onPress={optin} testID="lb-optin" />} testID="lb-optin-prompt" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            <Segmented value={metric} onChange={setMetric} testID="lb-metric"
              options={[{ key: "xp", label: t.leaderboard.xp }, { key: "streak", label: t.leaderboard.streak }, { key: "workouts", label: t.leaderboard.workouts }]} />
          </View>
          {q.isLoading ? <View style={{ padding: spacing.lg }}><Skeleton height={60} /></View> : (
            <FlatList
              data={q.data?.items ?? []}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
              ListEmptyComponent={<EmptyState title={t.errors.empty} testID="lb-empty" />}
              renderItem={({ item, index }) => (
                <Card style={[s.row, item.is_me && s.me]} testID={`lb-row-${index}`}>
                  <Text style={[s.rank, index < 3 && s.topRank]}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: "700" }}>{item.name} {item.is_me ? `(${t.leaderboard.you})` : ""}</Body>
                    <Body muted size={font.sm}>{t.gamification.level} {item.level}</Body>
                  </View>
                  <Text style={s.value}>{item.value}</Text>
                </Card>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  me: { borderColor: c.brandPrimary, borderWidth: 2 },
  rank: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.muted, width: 32, textAlign: "center" },
  topRank: { color: c.brandPrimary },
  value: { fontFamily: font.display, fontWeight: "700", fontSize: font.xl, color: c.onSurface },
}));
