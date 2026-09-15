import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { Barcode, CaretLeft, MagnifyingGlass, Plus, Trash } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, EmptyState, Skeleton, useToast } from "@/src/components/ui";
import { pickStore } from "@/src/pickStore";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function Food() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const today = new Date().toISOString().slice(0, 10);

  const [addOpen, setAddOpen] = useState(false);
  const [meal, setMeal] = useState<string>("breakfast");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  const summary = useQuery({ queryKey: ["food-summary", today], queryFn: () => api.get("/food/summary", { date: today }) });

  // barcode result handler via pickStore-like global
  useEffect(() => {
    (globalThis as any).__gbBarcode = (product: any) => {
      setAddOpen(true);
      setManual({ name: product.name, calories: String(product.calories), protein: String(product.protein), carbs: String(product.carbs), fat: String(product.fat) });
      setResults([]);
    };
    return () => { (globalThis as any).__gbBarcode = null; };
  }, []);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try { const r = await api.get("/food/search", { q: search }); setResults(r.items ?? []); }
    catch { toast.show(t.errors.generic, "error"); } finally { setSearching(false); }
  };

  const addEntry = async (food: any) => {
    await api.post("/food/entries", { name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, meal, quantity: 1, date: today });
    await qc.invalidateQueries({ queryKey: ["food-summary", today] });
    toast.show(t.food.addFood, "success");
    setAddOpen(false); setSearch(""); setResults([]);
  };

  const addManual = async () => {
    const cal = parseFloat(manual.calories) || 0;
    if (!manual.name.trim() || !cal) return;
    await addEntry({ name: manual.name, calories: cal, protein: parseFloat(manual.protein) || 0, carbs: parseFloat(manual.carbs) || 0, fat: parseFloat(manual.fat) || 0 });
    setManual({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  };

  const delEntry = async (id: string) => { await api.del(`/food/entries/${id}`); await qc.invalidateQueries({ queryKey: ["food-summary", today] }); };

  const totals = summary.data?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const entries = summary.data?.entries ?? [];

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="food-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <Display size={font.xl} style={{ flex: 1 }}>{t.food.title}</Display>
        <Pressable onPress={() => router.push("/food/scan")} hitSlop={10} testID="scan-barcode"><Barcode color={colors.brandPrimary} size={26} weight="fill" /></Pressable>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            {/* Macro summary */}
            <Card>
              <Body muted size={font.sm}>{t.food.today}</Body>
              <Display size={font["3xl"]} style={{ color: colors.brandPrimary }}>{Math.round(totals.calories)} <Text style={{ fontSize: font.base, color: colors.muted }}>kcal</Text></Display>
              <View style={s.macroRow}>
                {[["protein", totals.protein], ["carbs", totals.carbs], ["fat", totals.fat]].map(([k, v]) => (
                  <View key={k as string} style={s.macro}>
                    <Text style={s.macroVal}>{Math.round(v as number)}g</Text>
                    <Text style={s.macroLabel}>{(t.food as any)[k as string]}</Text>
                  </View>
                ))}
              </View>
            </Card>
            <Button title={t.food.addFood} onPress={() => setAddOpen(true)} testID="open-add-food"
              icon={<Plus color={colors.onBrandPrimary} size={18} weight="bold" />} />
            <Text style={s.section}>{t.food.meals}</Text>
          </View>
        }
        ListEmptyComponent={summary.isLoading ? <Skeleton height={60} /> : <EmptyState title={t.food.noEntries} testID="food-empty" />}
        renderItem={({ item }) => (
          <Card style={s.entryRow} testID={`food-entry-${item.id}`}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "600" }} numberOfLines={1}>{item.name}</Body>
              <Body muted size={font.sm}>{Math.round(item.calories * (item.quantity || 1))} kcal · {(t.food as any)[item.meal] ?? item.meal}</Body>
            </View>
            <Pressable onPress={() => delEntry(item.id)} hitSlop={8} testID={`del-food-${item.id}`}><Trash color={colors.muted} size={18} /></Pressable>
          </Card>
        )}
      />

      {/* Add food modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.food.addFood}</Display>
            {/* meal selector */}
            <View style={s.mealRow}>
              {MEALS.map((m) => (
                <Pressable key={m} style={[s.mealChip, meal === m && s.mealChipOn]} onPress={() => setMeal(m)} testID={`meal-${m}`}>
                  <Text style={[s.mealText, meal === m && s.mealTextOn]}>{(t.food as any)[m]}</Text>
                </Pressable>
              ))}
            </View>
            {/* search */}
            <View style={s.searchBox}>
              <MagnifyingGlass color={colors.muted} size={18} />
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} onSubmitEditing={doSearch}
                placeholder={t.food.searchFood} placeholderTextColor={colors.muted} testID="food-search" returnKeyType="search" />
              <Button title={t.common.search} small onPress={doSearch} loading={searching} testID="food-search-btn" />
            </View>
            {results.length > 0 ? (
              <FlatList data={results} keyExtractor={(r, i) => `${r.barcode}-${i}`} style={{ maxHeight: 220 }}
                renderItem={({ item }) => (
                  <Pressable style={s.resultRow} onPress={() => addEntry(item)} testID={`food-result-${item.barcode}`}>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: "600" }} numberOfLines={1}>{item.name}</Body>
                      <Body muted size={font.sm}>{item.brand ? item.brand + " · " : ""}{item.calories} kcal / 100g</Body>
                    </View>
                    <Plus color={colors.brandPrimary} size={20} weight="bold" />
                  </Pressable>
                )} />
            ) : null}
            {/* manual */}
            <Text style={s.section}>{t.food.manualEntry}</Text>
            <TextInput style={s.input} value={manual.name} onChangeText={(v) => setManual({ ...manual, name: v })} placeholder={t.food.foodName} placeholderTextColor={colors.muted} testID="manual-name" />
            <View style={s.macroInputs}>
              {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
                <TextInput key={k} style={s.macroInput} value={(manual as any)[k]} keyboardType="numeric"
                  onChangeText={(v) => setManual({ ...manual, [k]: v })} placeholder={(t.food as any)[k] ?? k} placeholderTextColor={colors.muted} testID={`manual-${k}`} />
              ))}
            </View>
            <Button title={t.food.addManually} onPress={addManual} testID="add-manual" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  macroRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  macro: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  macroVal: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg },
  macroLabel: { color: c.muted, fontFamily: font.text, fontSize: 11 },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.sm },
  entryRow: { flexDirection: "row", alignItems: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md, maxHeight: "88%" },
  mealRow: { flexDirection: "row", gap: spacing.sm },
  mealChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary, alignItems: "center" },
  mealChipOn: { backgroundColor: c.brandPrimary },
  mealText: { color: c.muted, fontFamily: font.text, fontSize: font.sm, fontWeight: "600" },
  mealTextOn: { color: c.onBrandPrimary },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  searchInput: { flex: 1, color: c.onSurface, fontFamily: font.text, height: 44 },
  resultRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  input: { backgroundColor: c.surfaceTertiary, borderRadius: radius.md, height: 48, paddingHorizontal: spacing.lg, color: c.onSurface, fontFamily: font.text },
  macroInputs: { flexDirection: "row", gap: spacing.sm },
  macroInput: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, height: 48, textAlign: "center", color: c.onSurface, fontFamily: font.text, fontSize: font.sm },
}));
