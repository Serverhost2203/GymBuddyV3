// Self-created exercise demonstration animation. Loops a stylized motion based
// on the movement pattern, with the working muscles highlighted. No external
// video/assets — fully internal (react-native-reanimated + SVG figure).
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { MuscleFigure } from "@/src/components/MuscleFigure";

type Props = { pattern?: string; primary?: string; secondary?: string[]; view?: "front" | "back"; width?: number };

export function ExerciseAnimation({ pattern = "push", primary, secondary, view = "front", width = 150 }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [p]);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    switch (pattern) {
      case "squat":
      case "lunge":
        return { transform: [{ translateY: t * 26 }, { scaleY: 1 - t * 0.08 }] };
      case "hinge":
        return { transform: [{ translateY: t * 10 }, { rotateX: `${t * 22}deg` }] };
      case "pull":
        return { transform: [{ translateY: -t * 14 }, { scale: 1 - t * 0.03 }] };
      case "core":
        return { transform: [{ rotate: `${(t - 0.5) * 10}deg` }, { translateY: t * 6 }] };
      case "cardio":
        return { transform: [{ translateY: t * 12 }] };
      case "carry":
        return { transform: [{ translateX: (t - 0.5) * 10 }] };
      default: // push / isolation
        return { transform: [{ translateY: -t * 12 }, { scale: 1 + t * 0.04 }] };
    }
  });

  return (
    <View style={{ width, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={style}>
        <MuscleFigure primary={primary} secondary={secondary} view={view} width={width} />
      </Animated.View>
    </View>
  );
}
