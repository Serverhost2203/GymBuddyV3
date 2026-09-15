import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Card, Display, Segmented, Skeleton, StatCard } from "@/src/components/ui";
import { ExerciseAnimation } from "@/src/components/ExerciseAnimation";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ExerciseDetail() {
  const { t, lang } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [view, setView] = useState<"front" | "back">("front");
  const [frame, setFrame] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const q = useQuery({ queryKey: ["exercise", id, lang], queryFn: () => api.get(`/exercises/${id}`, { lang }) });
  const ex = q.data;
  const photos: string[] = ex?.photos ?? [];

  useEffect(() => {
    if (!autoplay || photos.length < 2) return;
    const iv = setInterval(() => setFrame((f) => (f + 1) % photos.length), 900);
    return () => clearInterval(iv);
  }, [autoplay, photos.length]);

  const Section = ({ title, text }: { title: string; text?: string }) =>
    text ? (<View style={s.sec}><Text style={s.secTitle}>{title}</Text><Body muted>{text}</Body></View>) : null;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.back} onPress={() => router.back()} testID="detail-back"><CaretLeft color={colors.onSurface} size={26} /></Text>
        <Display size={font.lg} style={{ flex: 1 }} >{ex?.name ?? ""}</Display>
      </View>
      {q.isLoading || !ex ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><Skeleton height={300} /><Skeleton height={120} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
          {/* Real execution photos (Free Exercise DB) */}
          {photos.length ? (
            <Card>
              <Text style={s.secTitle}>{t.exercises.photos}</Text>
              <Pressable
                style={s.photoWrap}
                onPress={() => { setAutoplay(false); setFrame((f) => (f + 1) % photos.length); }}
                testID="exercise-photo"
              >
                <Image source={{ uri: photos[frame] }} style={s.photo} contentFit="cover" transition={200} />
                <View style={s.photoBadge}>
                  <Text style={s.photoBadgeText}>{frame === 0 ? t.exercises.startPos : t.exercises.endPos}</Text>
                </View>
              </Pressable>
              {photos.length > 1 ? (
                <View style={s.dots}>
                  {photos.map((_, i) => (
                    <View key={i} style={[s.pdot, i === frame && { backgroundColor: colors.brandPrimary }]} />
                  ))}
                </View>
              ) : null}
              <Body muted size={font.sm} style={{ marginTop: spacing.xs }}>{ex.photo_match === "representative" ? t.exercises.photoRepresentative : t.exercises.photoDemo}</Body>
              <Body muted size={11} style={{ marginTop: 2 }}>{t.exercises.photoSource}</Body>
            </Card>
          ) : null}

          {/* Muscle diagram */}
          <Card>
            <Segmented value={view} onChange={(v) => setView(v as any)} testID="muscle-view"
              options={[{ key: "front", label: t.exercises.front }, { key: "back", label: t.exercises.back }]} />
            <View style={s.figRow}>
              <ExerciseAnimation pattern={ex.movement_pattern} primary={ex.primary_muscle} secondary={ex.secondary_muscles} view={view} width={170} />
            </View>
            <View style={s.legend}>
              <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.brandPrimary }]} /><Body size={font.sm}>{t.exercises.primary}: {ex.primary_muscle_label}</Body></View>
              {ex.secondary_muscle_labels?.length ? (
                <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.brandSecondary }]} /><Body size={font.sm}>{t.exercises.secondary}: {ex.secondary_muscle_labels.join(", ")}</Body></View>
              ) : null}
            </View>
          </Card>

          {/* Meta */}
          <View style={s.statRow}>
            <StatCard label={t.exercises.difficulty} value={ex.difficulty_label} />
            <StatCard label={t.exercises.type} value={ex.exercise_type_label} />
            <StatCard label={t.exercises.personalBest} value={ex.personal_best ? `${ex.personal_best} kg` : "—"} accent />
          </View>

          {/* Equipment */}
          <Card>
            <Text style={s.secTitle}>{t.exercises.equipment}</Text>
            <View style={s.wrapRow}>
              {ex.required_equipment_labels.map((e: string, i: number) => (
                <View key={i} style={s.eqTag}><Text style={s.eqText}>{e}</Text></View>
              ))}
            </View>
            {!ex.available ? <Body style={{ color: colors.warning, marginTop: spacing.sm }} size={font.sm}>{t.exercises.notAvailable}</Body> : null}
          </Card>

          {/* Instructions */}
          <Card>
            <Section title={t.exercises.starting} text={ex.starting_position} />
            <Section title={t.exercises.execution} text={ex.execution} />
            <Section title={t.exercises.breathing} text={ex.breathing} />
            <Section title={t.exercises.safety} text={ex.safety} />
            {ex.common_mistakes?.length ? (
              <View style={s.sec}>
                <Text style={s.secTitle}>{t.exercises.mistakes}</Text>
                {ex.common_mistakes.map((m: string, i: number) => <Body key={i} muted>• {m}</Body>)}
              </View>
            ) : null}
            {ex.media_attribution ? <Body muted size={11} style={{ marginTop: spacing.sm }}>{ex.media_attribution}</Body> : null}
          </Card>

          {/* Alternatives */}
          {ex.alternatives_detail?.length ? (
            <Card>
              <Text style={s.secTitle}>{t.exercises.alternatives}</Text>
              {ex.alternatives_detail.map((a: any) => (
                <Text key={a.id} style={s.altRow} onPress={() => router.push(`/exercise/${a.id}`)} testID={`alt-${a.id}`}>{a.name}</Text>
              ))}
            </Card>
          ) : null}

          {/* History */}
          <Card>
            <Text style={s.secTitle}>{t.exercises.history}</Text>
            {ex.history?.length ? ex.history.map((h: any, i: number) => (
              <View key={i} style={s.histRow}>
                <Body muted size={font.sm}>{new Date(h.date).toLocaleDateString()}</Body>
                <Body size={font.sm}>{h.top_weight} kg · {Math.round(h.volume)} vol</Body>
              </View>
            )) : <Body muted>{t.exercises.noHistory}</Body>}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { paddingRight: spacing.xs },
  content: { padding: spacing.lg, gap: spacing.md },
  figRow: { alignItems: "center", paddingVertical: spacing.lg },
  photoWrap: { marginTop: spacing.sm, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  photoBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  photoBadgeText: { color: c.onBrandPrimary, fontFamily: font.text, fontWeight: "700", fontSize: font.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  pdot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statRow: { flexDirection: "row", gap: spacing.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  eqTag: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  eqText: { color: c.onSurfaceTertiary, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
  sec: { marginBottom: spacing.md, gap: 4 },
  secTitle: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.base, marginBottom: 2 },
  altRow: { color: c.brandPrimary, fontFamily: font.text, fontSize: font.base, paddingVertical: spacing.sm, fontWeight: "600" },
  histRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
}));
