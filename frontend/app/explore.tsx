import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { CaretLeft, ChatCircle, Heart, ImageSquare, MagnifyingGlass, User as UserIcon, X } from "phosphor-react-native";
import { useState } from "react";
import { Dimensions, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, EmptyState, Skeleton } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const COLS = 3;
const GAP = 2;

export default function Explore() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [q, setQ] = useState("");

  const tile = (Dimensions.get("window").width - GAP * (COLS - 1)) / COLS;

  const explore = useInfiniteQuery({
    queryKey: ["explore"], initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get("/explore", { offset: pageParam, limit: 30 }),
    getNextPageParam: (last: any, pages) => (last.items.length === 30 ? pages.length * 30 : undefined),
  });
  const search = useQuery({ queryKey: ["user-search", q], queryFn: () => api.get("/users/search", { q }), enabled: q.trim().length > 1 });

  const tiles = explore.data?.pages.flatMap((p: any) => p.items) ?? [];
  const users = search.data?.items ?? [];
  const searching = q.trim().length > 1;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="explore-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <View style={s.searchBox}>
          <MagnifyingGlass color={colors.muted} size={18} />
          <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder={t.feed.searchUsers}
            placeholderTextColor={colors.muted} testID="explore-search" returnKeyType="search" />
          {q ? <Pressable onPress={() => setQ("")} hitSlop={8} testID="explore-clear"><X color={colors.muted} size={18} /></Pressable> : null}
        </View>
      </View>

      {searching ? (
        <FlatList
          key="explore-users"
          data={users}
          keyExtractor={(u: any) => u.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
          ListHeaderComponent={<Body muted size={font.sm} style={{ marginBottom: spacing.xs }}>{t.feed.people}</Body>}
          ListEmptyComponent={!search.isLoading ? <Body muted style={{ marginTop: spacing.lg }}>{t.errors.empty}</Body> : <Skeleton height={56} />}
          renderItem={({ item: u }) => (
            <Pressable style={s.userRow} onPress={() => router.push(`/profile/${u.id}`)} testID={`search-user-${u.id}`}>
              <View style={s.avatar}>{u.avatar ? <Image source={{ uri: u.avatar }} style={s.avatarImg} /> : <UserIcon color={colors.muted} size={20} weight="fill" />}</View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }}>{u.name}</Body>
                <Body muted size={font.sm}>{t.gamification.level} {u.level}</Body>
              </View>
            </Pressable>
          )}
        />
      ) : explore.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={120} />)}</View>
      ) : (
        <FlatList
          key="explore-grid"
          data={tiles}
          keyExtractor={(p: any) => p.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + spacing.xl }}
          onEndReached={() => explore.hasNextPage && explore.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={<View style={{ padding: spacing.xl }}><EmptyState icon={<ImageSquare color={colors.brandPrimary} size={44} weight="fill" />} title={t.feed.exploreEmpty} testID="explore-empty" /></View>}
          renderItem={({ item }) => (
            <Pressable style={{ width: tile, height: tile }} onPress={() => router.push(`/feed/${item.id}`)} testID={`explore-tile-${item.id}`}>
              <Image source={{ uri: item.image }} style={s.tileImg} contentFit="cover" transition={150} />
              <View style={s.tileStats}>
                <View style={s.stat}><Heart color="#fff" size={14} weight="fill" /><Text style={s.statText}>{item.likes}</Text></View>
                <View style={s.stat}><ChatCircle color="#fff" size={14} weight="fill" /><Text style={s.statText}>{item.comments}</Text></View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, color: c.onSurface, fontFamily: font.text, fontSize: font.base },
  tileImg: { width: "100%", height: "100%", backgroundColor: c.surfaceTertiary },
  tileStats: { position: "absolute", bottom: 4, left: 4, flexDirection: "row", gap: spacing.sm },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { color: "#fff", fontFamily: font.text, fontWeight: "700", fontSize: 11 },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 44, height: 44 },
}));
