import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, Check, Clock, Trophy, UserMinus, UserPlus, User as UserIcon } from "phosphor-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Skeleton, StatCard, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function PublicProfile() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["profile", id], queryFn: () => api.get(`/users/${id}/profile`), retry: false });
  const status = useQuery({ queryKey: ["friend-status", id], queryFn: () => api.get(`/friends/status/${id}`) });
  const isPrivate = q.error instanceof ApiError && q.error.status === 403;
  const p = q.data;
  const rel = status.data?.status ?? "none";

  const addFriend = useMutation({
    mutationFn: () => api.post("/friends/request", { user_id: id }),
    onSuccess: () => { status.refetch(); toast.show(t.friends.requestSent, "success"); },
  });
  const accept = useMutation({
    mutationFn: () => api.post(`/friends/${status.data?.request_id}/accept`, {}),
    onSuccess: () => { status.refetch(); q.refetch(); qc.invalidateQueries({ queryKey: ["notif-unread"] }); },
  });
  const unfriend = useMutation({
    mutationFn: () => api.del(`/friends/${id}`),
    onSuccess: () => { status.refetch(); q.refetch(); },
  });

  const FriendButton = () => {
    if (rel === "friends") return <Button title={t.friends.friends} small variant="secondary" onPress={() => unfriend.mutate()} testID="pp-unfriend" icon={<UserMinus color={colors.onSurface} size={16} />} />;
    if (rel === "outgoing") return <Button title={t.friends.pending} small variant="ghost" onPress={() => unfriend.mutate()} testID="pp-cancel" icon={<Clock color={colors.brandPrimary} size={16} />} />;
    if (rel === "incoming") return <Button title={t.friends.accept} small onPress={() => accept.mutate()} testID="pp-accept" icon={<Check color={colors.onBrandPrimary} size={16} weight="bold" />} />;
    return <Button title={t.friends.addFriend} small onPress={() => addFriend.mutate()} testID="pp-add" icon={<UserPlus color={colors.onBrandPrimary} size={16} weight="fill" />} />;
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <CaretLeft color={colors.onSurface} size={26} onPress={() => router.back()} testID="pp-back" />
        <Display size={font.lg}>{t.feed.publicProfile}</Display>
      </View>
      {isPrivate ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg, alignItems: "center" }}>
          <EmptyState icon={<UserIcon color={colors.muted} size={44} weight="fill" />} title={t.feed.privateProfile} subtitle={t.feed.profilePrivateNote} testID="pp-private" />
          {rel !== "self" ? <FriendButton /> : null}
        </View>
      ) : q.isLoading || !p ? (
        <View style={{ padding: spacing.lg }}><Skeleton height={140} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={s.headerCard}>
            <View style={s.avatar}>{p.avatar ? <Image source={{ uri: p.avatar }} style={s.avatarImg} contentFit="cover" /> : <UserIcon color={colors.muted} size={34} weight="fill" />}</View>
            <Display size={font.xl}>{p.name}</Display>
            {!p.is_self ? <FriendButton /> : null}
          </View>
          <View style={s.statRow}>
            <StatCard label={t.gamification.level} value={String(p.level)} accent />
            <StatCard label="XP" value={String(p.xp)} />
            <StatCard label={t.gamification.best} value={String(p.best_streak)} />
            <StatCard label={t.feed.workouts} value={String(p.total_workouts)} />
          </View>

          {p.photos?.length ? (
            <View style={s.grid}>
              {p.photos.map((ph: any) => <Image key={ph.id} source={{ uri: ph.image }} style={s.gridImg} contentFit="cover" />)}
            </View>
          ) : null}

          {(p.posts ?? []).map((post: any) => (
            <Card key={post.id} testID={`pp-post-${post.id}`}>
              {post.type === "record" ? <View style={s.recBadge}><Trophy color={colors.brandPrimary} size={16} weight="fill" /><Body size={font.sm} style={{ color: colors.onBrandTertiary, fontWeight: "700" }}>{t.feed.record}</Body></View> : null}
              {post.text ? <Body style={{ marginTop: spacing.xs }}>{post.text}</Body> : null}
              {post.image ? <Image source={{ uri: post.image }} style={s.postImg} contentFit="cover" /> : null}
              <Body muted size={font.sm} style={{ marginTop: spacing.xs }}>❤ {post.likes} · 💬 {post.comments}</Body>
            </Card>
          ))}
          {(p.posts ?? []).length === 0 && (p.photos ?? []).length === 0 ? <EmptyState title={t.feed.empty} testID="pp-empty" /> : null}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 84, height: 84 },
  statRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridImg: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md },
  postImg: { width: "100%", height: 200, borderRadius: radius.md, marginTop: spacing.sm },
  recBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", backgroundColor: c.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
}));
