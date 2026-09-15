// Internal SVG muscle map — front & back. No external images.
// Highlights primary muscles in brandPrimary, secondary in brandSecondary.
import React from "react";
import { View } from "react-native";
import Svg, { Path, Ellipse, G } from "react-native-svg";

import { useTheme } from "@/src/theme";

type Props = { primary?: string; secondary?: string[]; width?: number; view?: "front" | "back" };

// Each region is a set of shapes. We keep it stylized but anatomically placed.
export function MuscleFigure({ primary, secondary = [], width = 150, view = "front" }: Props) {
  const { colors } = useTheme();
  const base = colors.surfaceTertiary;
  const outline = colors.borderStrong;
  const sec = new Set(secondary);
  const fill = (slug: string) =>
    primary === slug ? colors.brandPrimary : sec.has(slug) ? colors.brandSecondary : base;

  const H = 320;
  const W = 150;
  const scale = width / W;

  return (
    <View style={{ width, height: H * scale }}>
      <Svg width={width} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
        {/* Head */}
        <Ellipse cx="75" cy="26" rx="16" ry="19" fill={fill("neck")} stroke={outline} strokeWidth={1} />
        {/* Neck */}
        <Path d="M65 42 h20 v10 h-20 z" fill={fill("neck")} stroke={outline} strokeWidth={1} />
        {/* Torso silhouette */}
        <Path
          d="M45 54 Q75 48 105 54 L112 120 Q108 150 100 170 L95 210 H55 L50 170 Q42 150 38 120 Z"
          fill={colors.surfaceSecondary}
          stroke={outline}
          strokeWidth={1}
        />
        {view === "front" ? (
          <G>
            {/* Shoulders */}
            <Ellipse cx="46" cy="62" rx="13" ry="11" fill={fill("front_delt")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="104" cy="62" rx="13" ry="11" fill={fill("front_delt")} stroke={outline} strokeWidth={0.8} />
            {/* Chest */}
            <Path d="M52 66 Q75 62 74 62 L74 92 Q62 96 52 90 Z" fill={fill("chest")} stroke={outline} strokeWidth={0.8} />
            <Path d="M98 66 Q75 62 76 62 L76 92 Q88 96 98 90 Z" fill={fill("chest")} stroke={outline} strokeWidth={0.8} />
            {/* Abs */}
            <Path d="M64 98 h22 v46 h-22 z" fill={fill("abs")} stroke={outline} strokeWidth={0.8} />
            {/* Obliques */}
            <Path d="M55 100 l8 4 v34 l-8 -6 z" fill={fill("obliques")} stroke={outline} strokeWidth={0.6} />
            <Path d="M95 100 l-8 4 v34 l8 -6 z" fill={fill("obliques")} stroke={outline} strokeWidth={0.6} />
            {/* Biceps */}
            <Ellipse cx="38" cy="98" rx="8" ry="18" fill={fill("biceps")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="112" cy="98" rx="8" ry="18" fill={fill("biceps")} stroke={outline} strokeWidth={0.8} />
            {/* Forearms */}
            <Ellipse cx="34" cy="132" rx="7" ry="17" fill={fill("forearms")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="116" cy="132" rx="7" ry="17" fill={fill("forearms")} stroke={outline} strokeWidth={0.8} />
            {/* Quads */}
            <Path d="M55 214 q8 -6 18 0 l-2 60 h-14 z" fill={fill("quadriceps")} stroke={outline} strokeWidth={0.8} />
            <Path d="M95 214 q-8 -6 -18 0 l2 60 h14 z" fill={fill("quadriceps")} stroke={outline} strokeWidth={0.8} />
            {/* Adductors */}
            <Path d="M70 216 h10 v40 h-10 z" fill={fill("adductors")} stroke={outline} strokeWidth={0.5} />
            {/* Calves front (tibialis) */}
            <Ellipse cx="63" cy="292" rx="8" ry="22" fill={fill("calves")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="87" cy="292" rx="8" ry="22" fill={fill("calves")} stroke={outline} strokeWidth={0.8} />
          </G>
        ) : (
          <G>
            {/* Traps */}
            <Path d="M58 54 Q75 66 92 54 L86 74 H64 Z" fill={fill("traps")} stroke={outline} strokeWidth={0.8} />
            {/* Rear delts */}
            <Ellipse cx="46" cy="64" rx="12" ry="10" fill={fill("rear_delt")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="104" cy="64" rx="12" ry="10" fill={fill("rear_delt")} stroke={outline} strokeWidth={0.8} />
            {/* Upper back */}
            <Path d="M58 76 h34 v20 h-34 z" fill={fill("upper_back")} stroke={outline} strokeWidth={0.8} />
            {/* Lats */}
            <Path d="M54 92 l10 6 l-2 34 l-12 -12 z" fill={fill("lats")} stroke={outline} strokeWidth={0.8} />
            <Path d="M96 92 l-10 6 l2 34 l12 -12 z" fill={fill("lats")} stroke={outline} strokeWidth={0.8} />
            {/* Lower back */}
            <Path d="M64 128 h22 v24 h-22 z" fill={fill("lower_back")} stroke={outline} strokeWidth={0.8} />
            {/* Triceps */}
            <Ellipse cx="38" cy="98" rx="8" ry="18" fill={fill("triceps")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="112" cy="98" rx="8" ry="18" fill={fill("triceps")} stroke={outline} strokeWidth={0.8} />
            {/* Forearms */}
            <Ellipse cx="34" cy="132" rx="7" ry="17" fill={fill("forearms")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="116" cy="132" rx="7" ry="17" fill={fill("forearms")} stroke={outline} strokeWidth={0.8} />
            {/* Glutes */}
            <Ellipse cx="65" cy="190" rx="12" ry="14" fill={fill("glutes")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="85" cy="190" rx="12" ry="14" fill={fill("glutes")} stroke={outline} strokeWidth={0.8} />
            {/* Hamstrings */}
            <Path d="M55 214 q8 -4 18 0 l-2 54 h-14 z" fill={fill("hamstrings")} stroke={outline} strokeWidth={0.8} />
            <Path d="M95 214 q-8 -4 -18 0 l2 54 h14 z" fill={fill("hamstrings")} stroke={outline} strokeWidth={0.8} />
            {/* Calves */}
            <Ellipse cx="63" cy="288" rx="9" ry="24" fill={fill("calves")} stroke={outline} strokeWidth={0.8} />
            <Ellipse cx="87" cy="288" rx="9" ry="24" fill={fill("calves")} stroke={outline} strokeWidth={0.8} />
            {/* Abductors */}
            <Path d="M50 210 l6 2 v20 l-8 -6 z" fill={fill("abductors")} stroke={outline} strokeWidth={0.5} />
            <Path d="M100 210 l-6 2 v20 l8 -6 z" fill={fill("abductors")} stroke={outline} strokeWidth={0.5} />
          </G>
        )}
      </Svg>
    </View>
  );
}
