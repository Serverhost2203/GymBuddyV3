import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Display, useToast } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Scan() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const s = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const onScanned = async ({ data }: { data: string }) => {
    if (lockRef.current || busy) return;
    lockRef.current = true;
    setBusy(true);
    try {
      const res = await api.get(`/food/barcode/${data}`);
      if (res.found) {
        (globalThis as any).__gbBarcode?.(res.product);
        toast.show(t.food.productFound, "success");
        router.back();
      } else {
        toast.show(t.food.notFound, "error");
        setTimeout(() => { lockRef.current = false; setBusy(false); }, 1500);
      }
    } catch {
      toast.show(t.errors.generic, "error");
      setTimeout(() => { lockRef.current = false; setBusy(false); }, 1500);
    }
  };

  if (!permission) return <View style={s.root} />;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Display size={font.xl}>{t.food.scan}</Display>
        <Body muted style={{ textAlign: "center", marginVertical: spacing.md }}>{t.food.cameraPermission}</Body>
        {permission.canAskAgain ? (
          <Button title={t.food.grantCamera} onPress={requestPermission} testID="grant-camera" />
        ) : (
          <Button title={t.food.openSettings} onPress={() => Linking.openSettings()} testID="open-settings" />
        )}
        <Button title={t.common.back} variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] }}
        onBarcodeScanned={onScanned}
      />
      <View style={[s.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn} testID="scan-back"><CaretLeft color={colors.onSurfaceInverse} size={26} /></Pressable>
        <Text style={s.hint}>{t.food.scanning}</Text>
      </View>
      <View style={s.frame} pointerEvents="none" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: c.surface },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  hint: { color: "#fff", fontFamily: font.text, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  frame: { position: "absolute", top: "35%", left: "12%", right: "12%", height: 140, borderWidth: 3, borderColor: c.brandPrimary, borderRadius: radius.md },
}));
