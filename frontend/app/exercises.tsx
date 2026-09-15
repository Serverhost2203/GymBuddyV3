import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, FunnelSimple, MagnifyingGlass, X } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Chip, ChipRow, Display, EmptyState, Skeleton } from "@/src/components/ui";
import { MuscleFigure } from "@/src/components/MuscleFigure";
import { pickStore } from "@/src/pickStore";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Exercises() {
  const { t, lang } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const params = useLocalSearchParams<{ pick?: string }>();
  const isPicker = params.pick === "1";

  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const meta = useQuery({ queryKey: ["meta", lang], queryFn: () => api.get("/exercises/meta", { lang }) });

  const query = useInfiniteQuery({
    queryKey: ["exercises", { search, muscle, difficulty, availableOnly, lang }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get("/exercises", {
      search, muscle, difficulty, available_only: availableOnly, lang, limit: 30, offset: pageParam,
    }),
    getNextPageParam: (last: any, pages) => {
      const loaded = pages.reduce((n, p: any) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

  const items = query.data?.pages.flatMap((p: any) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const onPick = (ex: any) => {
    if (isPicker) {
      pickStore.resolve({ id: ex.id, name: ex.name, primary_muscle: ex.primary_muscle });
      router.back();
      return;
    }
    router.push(`/exercise/${ex.id}`);
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.titleRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="ex-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
          <Display size={font.xl}>{t.exercises.title}</Display>
          <Pressable onPress={() => setShowFilters(true)} hitSlop={10} testID="ex-filters"><FunnelSimple color={colors.brandPrimary} size={24} weight="fill" /></Pressable>
        </View>
        <View style={s.searchBox}>
          <MagnifyingGlass color={colors.muted} size={20} />
          <TextInput testID="ex-search" style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder={t.common.search} placeholderTextColor={colors.muted} />
          {search ? <Pressable onPress={() => setSearch("")}><X color={colors.muted} size={18} /></Pressable> : null}
        </View>
      </View>

      {/* muscle chip row */}
      <ChipRow>
        <Chip label={t.common.all} active={!muscle} onPress={() => setMuscle("")} testID="chip-all" />
        {(meta.data?.muscles ?? []).map((m: any) => (
          <Chip key={m.slug} label={m.label} active={muscle === m.slug} onPress={() => setMuscle(muscle === m.slug ? "" : m.slug)} testID={`chip-${m.slug}`} />
        ))}
      </ChipRow>

      <Text style={s.count}>{total} {t.exercises.results}</Text>

      {query.isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          onEndReached={() => query.hasNextPage && query.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<EmptyState title={t.exercises.noResults} testID="ex-empty" />}
          renderItem={({ item }) => (
            <Pressable style={[s.card, !item.available && s.cardDisabled]} onPress={() => onPick(item)} testID={`exercise-${item.id}`}>
              <View style={s.figWrap}><MuscleFigure primary={item.primary_muscle} secondary={item.secondary_muscles} width={40} /></View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }} numberOfLines={1}>{item.name}</Body>
                <Body muted size={font.sm} numberOfLines={1}>{item.primary_muscle_label} · {item.difficulty_label}</Body>
                <View style={s.eqRow}>
                  {item.required_equipment_labels.slice(0, 2).map((e: string, i: number) => (
                    <View key={i} style={s.eqTag}><Text style={s.eqText}>{e}</Text></View>
                  ))}
                </View>
              </View>
              {!item.available ? <View style={s.lock}><Text style={s.lockText}>🔒</Text></View> : null}
            </Pressable>
          )}
        />
      )}

      {/* Filters modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={s.overlay} onPress={() => setShowFilters(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.exercises.filters}</Display>
            <View style={s.filterRow}>
              <Body style={{ fontWeight: "700" }}>{t.exercises.availableOnly}</Body>
              <Pressable onPress={() => setAvailableOnly(!availableOnly)} style={[s.toggle, availableOnly && s.toggleOn]} testID="filter-available">
                <View style={[s.toggleDot, availableOnly && s.toggleDotOn]} />
              </Pressable>
            </View>
            <Body style={{ fontWeight: "700", marginTop: spacing.sm }}>{t.exercises.difficulty}</Body>
            <View style={s.wrapRow}>
              <Chip label={t.common.all} active={!difficulty} onPress={() => setDifficulty("")} />
              {(meta.data?.difficulties ?? []).map((dd: any) => (
                <Chip key={dd.slug} label={dd.label} active={difficulty === dd.slug} onPress={() => setDifficulty(difficulty === dd.slug ? "" : dd.slug)} testID={`diff-${dd.slug}`} />
              ))}
            </View>
            <Button title={t.common.done} onPress={() => setShowFilters(false)} style={{ marginTop: spacing.lg }} testID="filter-done" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, color: c.onSurface, fontFamily: font.text, fontSize: font.base },
  count: { color: c.muted, fontFamily: font.text, fontSize: font.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  cardDisabled: { opacity: 0.55 },
  figWrap: { width: 44, height: 90, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  eqRow: { flexDirection: "row", gap: spacing.xs, marginTop: 4 },
  eqTag: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  eqText: { color: c.onSurfaceTertiary, fontFamily: font.text, fontSize: 11 },
  lock: { paddingHorizontal: spacing.sm },
  lockText: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  toggle: { width: 52, height: 30, borderRadius: 15, backgroundColor: c.surfaceTertiary, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: c.brandPrimary },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.muted },
  toggleDotOn: { backgroundColor: c.onBrandPrimary, alignSelf: "flex-end" },
}));
