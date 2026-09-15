import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ChatCircle, Heart, MagnifyingGlass, Plus, Trophy, User as UserIcon } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Skeleton, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Feed() {
  const { t, user } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const [compose, setCompose] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const feed = useInfiniteQuery({
    queryKey: ["feed"], initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get("/feed", { offset: pageParam, limit: 20 }),
    getNextPageParam: (last: any, pages) => (last.items.length === 20 ? pages.length * 20 : undefined),
  });
  const search = useQuery({ queryKey: ["user-search", q], queryFn: () => api.get("/users/search", { q }), enabled: searchOpen && q.length > 1 });

  const items = feed.data?.pages.flatMap((p: any) => p.items) ?? [];

  const pickImg = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (!r.canceled && r.assets[0]?.base64) setImage(`data:image/jpeg;base64,${r.assets[0].base64}`);
  };

  const submit = async () => {
    if (!text.trim() && !image) return;
    await api.post("/posts", { text, image, type: isRecord ? "record" : image ? "photo" : "text", visibility: "public" });
    setText(""); setImage(null); setIsRecord(false); setCompose(false);
    await qc.invalidateQueries({ queryKey: ["feed"] });
    if (!user?.privacy?.profile_public) toast.show(t.feed.makePublicHint, "info");
    else toast.show(t.feed.post, "success");
  };

  const like = async (id: string) => { await api.post(`/posts/${id}/like`, {}); await qc.invalidateQueries({ queryKey: ["feed"] }); };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Display size={font["2xl"]}>{t.feed.title}</Display>
        <View style={s.headerBtns}>
          <Pressable onPress={() => setSearchOpen(true)} hitSlop={10} testID="feed-search-btn"><MagnifyingGlass color={colors.onSurface} size={24} /></Pressable>
          <Pressable onPress={() => setCompose(true)} hitSlop={10} style={s.newBtn} testID="feed-new-post"><Plus color={colors.onBrandPrimary} size={20} weight="bold" /></Pressable>
        </View>
      </View>

      {feed.isLoading ? <View style={{ padding: spacing.lg, gap: spacing.md }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={120} />)}</View> : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 100 }}
          onEndReached={() => feed.hasNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={<EmptyState icon={<Trophy color={colors.brandPrimary} size={44} weight="fill" />} title={t.feed.empty} testID="feed-empty" />}
          renderItem={({ item }) => (
            <Card testID={`post-${item.id}`}>
              <Pressable style={s.postHead} onPress={() => router.push(`/profile/${item.author.id}`)} testID={`author-${item.author.id}`}>
                <View style={s.avatar}>{item.author.avatar ? <Image source={{ uri: item.author.avatar }} style={s.avatarImg} /> : <UserIcon color={colors.muted} size={20} weight="fill" />}</View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }}>{item.author.name}</Body>
                  <Body muted size={font.sm}>{t.gamification.level} {item.author.level}</Body>
                </View>
                {item.type === "record" ? <Trophy color={colors.brandPrimary} size={20} weight="fill" /> : null}
              </Pressable>
              {item.text ? <Body style={{ marginTop: spacing.sm }}>{item.text}</Body> : null}
              {item.image ? <Image source={{ uri: item.image }} style={s.postImg} contentFit="cover" /> : null}
              <View style={s.actions}>
                <Pressable style={s.action} onPress={() => like(item.id)} testID={`like-${item.id}`}>
                  <Heart color={item.liked ? colors.error : colors.muted} size={22} weight={item.liked ? "fill" : "regular"} />
                  <Text style={s.actionText}>{item.likes}</Text>
                </Pressable>
                <Pressable style={s.action} onPress={() => router.push(`/feed/${item.id}`)} testID={`comments-${item.id}`}>
                  <ChatCircle color={colors.muted} size={22} />
                  <Text style={s.actionText}>{item.comments}</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      {/* Composer */}
      <Modal visible={compose} transparent animationType="slide" onRequestClose={() => setCompose(false)}>
        <Pressable style={s.overlay} onPress={() => setCompose(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.feed.newPost}</Display>
            <TextInput style={s.input} value={text} onChangeText={setText} placeholder={t.feed.whatsOnMind} placeholderTextColor={colors.muted} multiline testID="post-text" />
            {image ? <Image source={{ uri: image }} style={s.preview} contentFit="cover" /> : null}
            <View style={s.composeRow}>
              <Button title={t.feed.photo} variant="secondary" small onPress={pickImg} testID="post-photo" />
              <View style={s.recordToggle}>
                <Trophy color={colors.brandPrimary} size={18} weight="fill" />
                <Text style={s.recordText}>{t.feed.record}</Text>
                <Switch value={isRecord} onValueChange={setIsRecord} testID="post-record"
                  trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onBrandPrimary} />
              </View>
            </View>
            {!user?.privacy?.profile_public ? <Body muted size={font.sm}>{t.feed.makePublicHint}</Body> : null}
            <Button title={t.feed.post} onPress={submit} testID="post-submit" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search */}
      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setSearchOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.feed.searchUsers}</Display>
            <View style={s.searchBox}>
              <MagnifyingGlass color={colors.muted} size={18} />
              <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder={t.feed.searchUsers} placeholderTextColor={colors.muted} autoFocus testID="user-search-input" />
            </View>
            {(search.data?.items ?? []).map((u: any) => (
              <Pressable key={u.id} style={s.userRow} onPress={() => { setSearchOpen(false); router.push(`/profile/${u.id}`); }} testID={`search-user-${u.id}`}>
                <View style={s.avatar}>{u.avatar ? <Image source={{ uri: u.avatar }} style={s.avatarImg} /> : <UserIcon color={colors.muted} size={18} weight="fill" />}</View>
                <View style={{ flex: 1 }}><Body style={{ fontWeight: "700" }}>{u.name}</Body><Body muted size={font.sm}>{t.gamification.level} {u.level}</Body></View>
              </Pressable>
            ))}
            {q.length > 1 && (search.data?.items ?? []).length === 0 && !search.isLoading ? <Body muted>{t.errors.empty}</Body> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  newBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  postImg: { width: "100%", height: 220, borderRadius: radius.md, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionText: { color: c.muted, fontFamily: font.text, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md, maxHeight: "85%" },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, minHeight: 90, color: c.onSurface, fontFamily: font.text, fontSize: font.base, textAlignVertical: "top" },
  preview: { width: "100%", height: 180, borderRadius: radius.md },
  composeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recordText: { color: c.onSurface, fontFamily: font.text, fontWeight: "600" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48 },
  searchInput: { flex: 1, color: c.onSurface, fontFamily: font.text },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
}));
