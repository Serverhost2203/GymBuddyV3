// Interactive BMI scale with colored zones and a marker at the user's BMI.
import { View } from "react-native";

import { Body } from "@/src/components/ui";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const ZONES = [
  { key: "underweight", min: 15, max: 18.5, color: "#42A5F5" },
  { key: "normal", min: 18.5, max: 25, color: "#00C853" },
  { key: "overweight", min: 25, max: 30, color: "#FFB300" },
  { key: "obese", min: 30, max: 40, color: "#FF3B30" },
];
const LO = 15, HI = 40;

export function BMIScale({ bmi, categoryLabel }: { bmi: number; categoryLabel: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, (bmi - LO) / (HI - LO)));

  return (
    <View style={s.wrap} testID="bmi-scale">
      <View style={s.bar}>
        {ZONES.map((z) => (
          <View key={z.key} style={{ flex: z.max - z.min, backgroundColor: z.color, height: 14 }} />
        ))}
        <View style={[s.marker, { left: `${pct * 100}%` }]}>
          <View style={[s.markerDot, { borderColor: colors.onSurface }]} />
        </View>
      </View>
      <View style={s.labels}>
        <Body muted size={11}>15</Body>
        <Body muted size={11}>18.5</Body>
        <Body muted size={11}>25</Body>
        <Body muted size={11}>30</Body>
        <Body muted size={11}>40</Body>
      </View>
      <View style={s.legend}>
        {ZONES.map((z) => (
          <View key={z.key} style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: z.color }]} />
          </View>
        ))}
      </View>
      <Body style={{ textAlign: "center", fontWeight: "700", marginTop: spacing.sm }}>{bmi} · {categoryLabel}</Body>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { marginTop: spacing.md },
  bar: { flexDirection: "row", borderRadius: radius.pill, overflow: "hidden", position: "relative" },
  marker: { position: "absolute", top: -6, marginLeft: -8 },
  markerDot: { width: 16, height: 26, borderRadius: 6, backgroundColor: c.surfaceInverse, borderWidth: 3 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  legend: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.xs },
  legendItem: { alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
}));
