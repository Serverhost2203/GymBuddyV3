import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { Barbell } from "phosphor-react-native";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Display } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { ApiError } from "@/src/api";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Login() {
  const { login, t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setError(t.errors.invalidEmail);
    if (password.length < 8) return setError(t.errors.passwordShort);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.errors.network : t.errors.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.brandTertiary, colors.surface]} style={s.grad} />
      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing["3xl"], paddingBottom: insets.bottom + spacing.xl }]} bottomOffset={20}>
        <View style={s.logo}><Barbell color={colors.brandPrimary} size={40} weight="fill" /></View>
        <Display size={font["3xl"]}>{t.appName}</Display>
        <Body muted style={{ marginBottom: spacing["2xl"] }}>{t.auth.tagline}</Body>

        <Body style={s.label}>{t.auth.email}</Body>
        <TextInput testID="login-email" style={s.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com"
          placeholderTextColor={colors.muted} />

        <Body style={s.label}>{t.auth.password}</Body>
        <TextInput testID="login-password" style={s.input} value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} />

        {error ? <Text style={s.error} testID="login-error">{error}</Text> : null}

        <Button testID="login-submit" title={t.auth.login} onPress={submit} loading={loading} style={{ marginTop: spacing.lg }} />

        <View style={s.footer}>
          <Body muted>{t.auth.noAccount} </Body>
          <Link href="/(auth)/register" testID="go-register"><Text style={s.link}>{t.auth.signUp}</Text></Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grad: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  logo: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg, borderWidth: 1, borderColor: c.border },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: "600" },
  input: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, color: c.onSurface, fontSize: font.lg, borderWidth: 1, borderColor: c.border, fontFamily: font.text },
  error: { color: c.error, marginTop: spacing.md, fontFamily: font.text },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  link: { color: c.brandPrimary, fontWeight: "700", fontFamily: font.text },
}));
