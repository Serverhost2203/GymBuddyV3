import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CaretLeft, LockKey } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { Body, Button, Display } from "@/src/components/ui";
import { PasswordInput } from "@/src/components/PasswordInput";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Forgot() {
  const { t, resetPassword } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setError(""); setInfo("");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setError(t.errors.invalidEmail);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() }, false);
      setInfo(t.auth.codeSent);
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 403 ? e.message : t.errors.generic);
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    setError("");
    if (code.trim().length !== 6) return setError(t.auth.invalidCode);
    if (password.length < 8) return setError(t.errors.passwordShort);
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? t.auth.invalidCode : t.errors.generic);
    } finally { setLoading(false); }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.brandTertiary, colors.surface]} style={s.grad} />
      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]} bottomOffset={20}>
        <View style={s.headRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} testID="forgot-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        </View>
        <View style={s.logo}><LockKey color={colors.brandPrimary} size={36} weight="fill" /></View>
        <Display size={font["2xl"]}>{t.auth.resetTitle}</Display>
        <Body muted style={{ marginBottom: spacing.xl }}>{t.auth.resetIntro}</Body>

        <Body style={s.label}>{t.auth.email}</Body>
        <TextInput testID="forgot-email" style={s.input} value={email} onChangeText={setEmail}
          editable={step === "email"} autoCapitalize="none" keyboardType="email-address"
          placeholder="you@email.com" placeholderTextColor={colors.muted} />

        {step === "code" ? (
          <>
            <Body style={s.label}>{t.auth.code}</Body>
            <TextInput testID="forgot-code" style={s.input} value={code} onChangeText={setCode}
              keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={colors.muted} />
            <Body style={s.label}>{t.auth.newPassword}</Body>
            <PasswordInput testID="forgot-password" style={s.input} value={password} onChangeText={setPassword} placeholder="min. 8 chars" />
          </>
        ) : null}

        {info ? <Text style={s.info} testID="forgot-info">{info}</Text> : null}
        {error ? <Text style={s.error} testID="forgot-error">{error}</Text> : null}

        {step === "email" ? (
          <Button testID="forgot-send" title={t.auth.sendCode} onPress={sendCode} loading={loading} style={{ marginTop: spacing.lg }} />
        ) : (
          <Button testID="forgot-submit" title={t.auth.resetSubmit} onPress={submitReset} loading={loading} style={{ marginTop: spacing.lg }} />
        )}

        <Text style={s.link} onPress={() => router.replace("/(auth)/login")} testID="forgot-to-login">{t.auth.backToLogin}</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grad: { position: "absolute", top: 0, left: 0, right: 0, height: 280 },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  headRow: { marginBottom: spacing.md },
  logo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 1, borderColor: c.border },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: "600", color: c.onSurface, fontFamily: font.text },
  input: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, color: c.onSurface, fontSize: font.lg, borderWidth: 1, borderColor: c.border, fontFamily: font.text },
  info: { color: c.success, marginTop: spacing.md, fontFamily: font.text },
  error: { color: c.error, marginTop: spacing.md, fontFamily: font.text },
  link: { color: c.brandPrimary, fontWeight: "700", fontFamily: font.text, textAlign: "center", marginTop: spacing.xl },
}));
