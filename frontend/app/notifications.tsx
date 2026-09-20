import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { Bell, CaretLeft, Check, UserPlus, X } from "phosphor-react-native";
import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Card, Display, EmptyState, Skeleton } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, spacing, useTheme } from "@/src/theme";

export default function Notifications() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const s = useStyles();

  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });

  useEffect(() => {
    api.post("/notifications/read", {}).then(() => qc.invalidateQueries({ queryKey: ["notif-unread"] })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = useMutation({
    mutationFn: ({ rid, action }: { rid: string; action: "accept" | "decline" }) => api.post(`/friends/${rid}/${action}`, {}),
    onSuccess: () => { q.refetch(); qc.invalidateQueries({ queryKey: ["notif-unread"] }); },
  });

  const items = q.data?.items ?? [];

  const label = (n: any) => {
    if (n.type === "friend_request") return t.notifications.sentRequest;
    if (n.type === "friend_accept") return t.notifications.acceptedRequest;
    return "";
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="notif-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <Display size={font.lg}>{t.notifications.title}</Display>
      </View>
      {q.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}</View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n: any) => n.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<View style={{ paddingTop: spacing.xl }}><EmptyState icon={<Bell color={colors.brandPrimary} size={44} weight="fill" />} title={t.notifications.empty} testID="notif-empty" /></View>}
          renderItem={({ item: n }) => (
            <Card style={[s.row, !n.read && s.unreadRow]} testID={`notif-${n.id}`}>
              <Pressable style={s.avatar} onPress={() => router.push(`/profile/${n.actor.id}`)}>
                {n.actor.avatar ? <Image source={{ uri: n.actor.avatar }} style={s.avatarImg} /> : <UserPlus color={colors.muted} size={18} weight="fill" />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Body size={font.sm}><Text style={{ fontWeight: "700" }}>{n.actor.name}</Text> {label(n)}</Body>
              </View>
              {n.type === "friend_request" && n.request_id ? (
                <View style={s.actions}>
                  <Pressable style={[s.iconBtn, { backgroundColor: colors.brandPrimary }]} onPress={() => respond.mutate({ rid: n.request_id, action: "accept" })} testID={`accept-${n.request_id}`}>
                    <Check color={colors.onBrandPrimary} size={18} weight="bold" />
                  </Pressable>
                  <Pressable style={[s.iconBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={() => respond.mutate({ rid: n.request_id, action: "decline" })} testID={`decline-${n.request_id}`}>
                    <X color={colors.onSurface} size={18} weight="bold" />
                  </Pressable>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  unreadRow: { borderLeftWidth: 3, borderLeftColor: c.brandPrimary },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  actions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
}));
