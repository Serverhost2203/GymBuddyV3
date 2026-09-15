import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { UserPlus } from "phosphor-react-native";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Display } from "@/src/components/ui";
import { ApiError } from "@/src/api";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Register() {
  const { register, t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError(t.errors.nameRequired);
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setError(t.errors.invalidEmail);
    if (password.length < 8) return setError(t.errors.passwordShort);
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/onboarding");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError(t.errors.emailTaken);
      else setError(e instanceof ApiError && e.status === 0 ? t.errors.network : t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.brandTertiary, colors.surface]} style={s.grad} />
      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]} bottomOffset={20}>
        <View style={s.logo}><UserPlus color={colors.brandPrimary} size={36} weight="fill" /></View>
        <Display size={font["2xl"]}>{t.auth.register}</Display>
        <Body muted style={{ marginBottom: spacing.xl }}>{t.auth.tagline}</Body>

        <Body style={s.label}>{t.auth.name}</Body>
        <TextInput testID="reg-name" style={s.input} value={name} onChangeText={setName} placeholder="Alex" placeholderTextColor={colors.muted} />

        <Body style={s.label}>{t.auth.email}</Body>
        <TextInput testID="reg-email" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com" placeholderTextColor={colors.muted} />

        <Body style={s.label}>{t.auth.password}</Body>
        <TextInput testID="reg-password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="min. 8 chars" placeholderTextColor={colors.muted} />

        {error ? <Text style={s.error} testID="reg-error">{error}</Text> : null}
        <Button testID="reg-submit" title={t.auth.signUp} onPress={submit} loading={loading} style={{ marginTop: spacing.lg }} />

        <View style={s.footer}>
          <Body muted>{t.auth.haveAccount} </Body>
          <Link href="/(auth)/login" testID="go-login"><Text style={s.link}>{t.auth.signIn}</Text></Link>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grad: { position: "absolute", top: 0, left: 0, right: 0, height: 280 },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  logo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 1, borderColor: c.border },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: "600" },
  input: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, color: c.onSurface, fontSize: font.lg, borderWidth: 1, borderColor: c.border, fontFamily: font.text },
  error: { color: c.error, marginTop: spacing.md, fontFamily: font.text },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  link: { color: c.brandPrimary, fontWeight: "700", fontFamily: font.text },
}));
