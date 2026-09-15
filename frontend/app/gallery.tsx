import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { CaretLeft, Eye, EyeSlash, Plus, Trash } from "phosphor-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Display, EmptyState, Skeleton, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Gallery() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();

  const q = useQuery({ queryKey: ["gallery"], queryFn: () => api.get("/gallery") });

  const add = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show(t.food.openSettings, "error");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (!r.canceled && r.assets[0]?.base64) {
      await api.post("/gallery", { image: `data:image/jpeg;base64,${r.assets[0].base64}`, visibility: "private" });
      await qc.invalidateQueries({ queryKey: ["gallery"] });
    }
  };

  const toggleVis = async (item: any) => {
    await api.patch(`/gallery/${item.id}`, { visibility: item.visibility === "public" ? "private" : "public" });
    await qc.invalidateQueries({ queryKey: ["gallery"] });
  };
  const del = async (id: string) => { await api.del(`/gallery/${id}`); await qc.invalidateQueries({ queryKey: ["gallery"] }); };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <CaretLeft color={colors.onSurface} size={26} onPress={() => router.back()} testID="gallery-back" />
        <Display size={font.xl} style={{ flex: 1 }}>{t.gallery.title}</Display>
        <Pressable style={s.addBtn} onPress={add} testID="gallery-add"><Plus color={colors.onBrandPrimary} size={20} weight="bold" /></Pressable>
      </View>
      {q.isLoading ? <View style={{ padding: spacing.lg }}><Skeleton height={200} /></View> : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(g) => g.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          ListHeaderComponent={<Body muted size={font.sm} style={{ marginBottom: spacing.sm }}>{t.gallery.publicNote}</Body>}
          ListEmptyComponent={<EmptyState title={t.gallery.empty} action={<Button title={t.gallery.add} onPress={add} testID="gallery-empty-add" />} testID="gallery-empty" />}
          renderItem={({ item }) => (
            <View style={s.cell} testID={`gallery-${item.id}`}>
              <Image source={{ uri: item.image }} style={s.img} contentFit="cover" />
              <View style={s.cellBar}>
                <Pressable style={s.visBtn} onPress={() => toggleVis(item)} testID={`vis-${item.id}`}>
                  {item.visibility === "public" ? <Eye color={colors.success} size={16} weight="fill" /> : <EyeSlash color={colors.muted} size={16} />}
                  <Text style={[s.visText, { color: item.visibility === "public" ? colors.success : colors.muted }]}>{item.visibility === "public" ? t.gallery.public : t.gallery.private}</Text>
                </Pressable>
                <Pressable onPress={() => del(item.id)} hitSlop={6} testID={`gallery-del-${item.id}`}><Trash color={colors.error} size={16} /></Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  cell: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  img: { width: "100%", aspectRatio: 1 },
  cellBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm },
  visBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  visText: { fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
}));
