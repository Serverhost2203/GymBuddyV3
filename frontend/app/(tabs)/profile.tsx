import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  CaretRight, Crown, Gear, Medal, ShieldCheck, SignOut, Trophy, User as UserIcon,
} from "phosphor-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Button, Card, Display, useToast } from "@/src/components/ui";
import { syncReminders } from "@/src/notifications";
import { useApp } from "@/src/context";
import { LANGUAGES, type Lang } from "@/src/i18n";
import { font, makeStyles, radius, setColorScheme, spacing, useTheme } from "@/src/theme";

export default function Profile() {
  const { user, t, lang, setLang, logout, updateUser, isPremium, refresh } = useApp();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useStyles();
  const [langModal, setLangModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = async (data: any) => {
    updateUser(data);
    try { const u = await api.put("/users/me", data); updateUser(u); } catch { toast.show(t.errors.generic, "error"); }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show(t.food.openSettings, "error");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.4, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled && res.assets[0]?.base64) {
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      patch({ avatar: uri });
    }
  };

  const toggleNotif = (key: string, val: boolean) => {
    const nextNotifs = { ...user?.notifications, [key]: val };
    patch({ notifications: nextNotifs });
    syncReminders({ notifications: nextNotifs, training_days: user?.training_days }).catch(() => {});
  };
  const togglePrivacy = (key: string, val: boolean) => patch({ privacy: { ...user?.privacy, [key]: val } });

  const setTheme = (mode: "dark" | "light") => { setColorScheme(mode); };

  const toggleSub = async () => {
    const tier = isPremium ? "free" : "premium";
    await api.post("/subscription/set", { tier });
    updateUser({ subscription: tier } as any);
    await refresh();
    toast.show(tier === "premium" ? t.profile.premiumActive : t.profile.free, "success");
  };

  const optinLeaderboard = async (v: boolean) => {
    updateUser({ leaderboard_optin: v } as any);
    await api.put("/users/me/leaderboard-optin", { optin: v });
  };

  const doExport = async () => {
    await api.get("/users/me/export");
    toast.show(t.profile.exportData, "success");
  };

  const doDelete = async () => {
    await api.del("/users/me");
    setConfirmDelete(false);
    await logout();
    router.replace("/(auth)/login");
  };

  const Row = ({ icon, label, right, onPress, testID }: any) => (
    <Pressable style={s.row} onPress={onPress} testID={testID}>
      {icon}
      <Text style={s.rowLabel}>{label}</Text>
      {right ?? <CaretRight color={colors.muted} size={18} />}
    </Pressable>
  );

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.headerCard}>
          <Pressable onPress={pickAvatar} style={s.avatar} testID="edit-avatar">
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={s.avatarImg} contentFit="cover" /> :
              <UserIcon color={colors.muted} size={36} weight="fill" />}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Display size={font.xl}>{user?.name}</Display>
            <Body muted size={font.sm}>{user?.email}</Body>
            <View style={s.badges}>
              <View style={s.badge}><Trophy color={colors.brandPrimary} size={14} weight="fill" /><Text style={s.badgeText}>{t.gamification.level} {user?.level}</Text></View>
              {isPremium ? <View style={[s.badge, s.premiumBadge]}><Crown color={colors.onWarning} size={14} weight="fill" /><Text style={[s.badgeText, { color: colors.onWarning }]}>{t.profile.premium}</Text></View> : null}
              {user?.role === "admin" ? <View style={[s.badge, s.adminBadge]}><ShieldCheck color={colors.onSuccess} size={14} weight="fill" /><Text style={[s.badgeText, { color: colors.onSuccess }]}>Admin</Text></View> : null}
            </View>
          </View>
        </View>

        <Button title={t.profile.editProfile} variant="secondary" onPress={() => router.push("/settings")} testID="edit-profile-btn"
          icon={<Gear color={colors.onSurfaceTertiary} size={18} weight="fill" />} />

        {/* Gamification + Leaderboard */}
        <Card style={{ gap: spacing.sm }}>
          <Row icon={<Medal color={colors.warning} size={20} weight="fill" />} label={t.gamification.title} onPress={() => router.push("/achievements")} testID="achievements-link" />
          <View style={s.div} />
          <Row icon={<UserIcon color={colors.brandPrimary} size={20} weight="fill" />} label={t.gallery.title} onPress={() => router.push("/gallery")} testID="gallery-link" />
          <View style={s.div} />
          <Row icon={<UserIcon color={colors.muted} size={20} />} label={t.feed.viewProfile} onPress={() => router.push(`/profile/${user?.id}`)} testID="my-public-profile" />
          <View style={s.div} />
          <View style={s.row}>
            <Trophy color={colors.brandPrimary} size={20} weight="fill" />
            <Text style={s.rowLabel}>{t.profile.leaderboardOptin}</Text>
            <Switch value={!!user?.leaderboard_optin} onValueChange={optinLeaderboard} testID="leaderboard-optin"
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onBrandPrimary} />
          </View>
          {user?.leaderboard_optin ? <><View style={s.div} /><Row icon={<Trophy color={colors.muted} size={20} />} label={t.leaderboard.title} onPress={() => router.push("/leaderboard")} testID="leaderboard-link" /></> : null}
        </Card>

        {/* Language */}
        <Text style={s.section}>{t.profile.language}</Text>
        <Card>
          <Row label={`${LANGUAGES.find((l) => l.code === lang)?.flag} ${LANGUAGES.find((l) => l.code === lang)?.label}`}
            icon={null} onPress={() => setLangModal(true)} testID="language-row" />
        </Card>

        {/* Theme + Units */}
        <Text style={s.section}>{t.profile.theme}</Text>
        <Card style={{ gap: spacing.sm }}>
          <View style={s.segWrap}>
            {(["dark", "light"] as const).map((m) => (
              <Pressable key={m} onPress={() => setTheme(m)} style={[s.segItem, scheme === m && s.segActive]} testID={`theme-${m}`}>
                <Text style={[s.segText, scheme === m && s.segTextActive]}>{m === "dark" ? t.profile.themeDark : t.profile.themeLight}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.segWrap}>
            {(["metric", "imperial"] as const).map((u) => (
              <Pressable key={u} onPress={() => patch({ units: u })} style={[s.segItem, user?.units === u && s.segActive]} testID={`units-${u}`}>
                <Text style={[s.segText, user?.units === u && s.segTextActive]}>{u === "metric" ? t.profile.metric : t.profile.imperial}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Notifications */}
        <Text style={s.section}>{t.reminders.title}</Text>
        <Card style={{ gap: spacing.xs }}>
          {[["workouts", t.profile.notifyWorkouts], ["weight", t.profile.notifyWeight], ["measurements", t.profile.notifyMeasurements], ["streak", t.profile.notifyStreak]].map(([k, label]) => (
            <View key={k} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Switch value={!!user?.notifications?.[k]} onValueChange={(v) => toggleNotif(k, v)} testID={`notif-${k}`}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onBrandPrimary} />
            </View>
          ))}
          <View style={s.div} />
          {[["workout_time", t.reminders.workoutTime, "18:00"], ["weight_time", t.reminders.weightTime, "08:00"], ["meal_time", t.reminders.mealTime, "12:00"]].map(([k, label, ph]) => (
            <View key={k} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <TextInput style={s.timeInput} defaultValue={user?.notifications?.[k] ?? ""} placeholder={ph} placeholderTextColor={colors.muted}
                onEndEditing={(e) => { const v = e.nativeEvent.text; const nn = { ...user?.notifications, [k]: v }; patch({ notifications: nn }); syncReminders({ notifications: nn, training_days: user?.training_days }).catch(() => {}); }}
                testID={`time-${k}`} />
            </View>
          ))}
          <Body muted size={font.sm}>{t.reminders.permission}</Body>
        </Card>

        {/* Privacy */}
        <Text style={s.section}>{t.profile.privacy}</Text>
        <Card style={{ gap: spacing.xs }}>
          {[["profile_public", t.profile.profilePublic], ["share_workouts", t.profile.shareWorkouts]].map(([k, label]) => (
            <View key={k} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Switch value={!!user?.privacy?.[k]} onValueChange={(v) => togglePrivacy(k, v)} testID={`privacy-${k}`}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onBrandPrimary} />
            </View>
          ))}
        </Card>

        {/* Subscription */}
        <Text style={s.section}>{t.subscription.title}</Text>
        <Card style={{ gap: spacing.sm }}>
          <View style={s.row}>
            <Crown color={colors.warning} size={20} weight="fill" />
            <Text style={s.rowLabel}>{isPremium ? t.profile.premiumActive : t.profile.free}</Text>
          </View>
          <Body muted size={font.sm}>{t.subscription.premiumBlurb}</Body>
          <Body muted size={font.sm}>{t.subscription.note}</Body>
          <Button title={isPremium ? t.profile.downgradeFree : t.profile.upgradeToPremium} small
            variant={isPremium ? "ghost" : "primary"} onPress={toggleSub} testID="toggle-subscription" />
        </Card>

        {/* Admin */}
        {user?.role === "admin" ? (
          <Button title={t.profile.admin} onPress={() => router.push("/admin")} testID="admin-dashboard-btn"
            icon={<ShieldCheck color={colors.onBrandPrimary} size={18} weight="fill" />} style={{ marginTop: spacing.sm }} />
        ) : null}

        {/* Account */}
        <Text style={s.section}>{t.profile.account}</Text>
        <Card style={{ gap: spacing.sm }}>
          <Row label={t.profile.exportData} icon={null} onPress={doExport} testID="export-data" />
          <View style={s.div} />
          <Pressable style={s.row} onPress={() => setConfirmDelete(true)} testID="delete-account">
            <Text style={[s.rowLabel, { color: colors.error }]}>{t.profile.deleteAccount}</Text>
          </Pressable>
        </Card>

        <Button title={t.auth.logout} variant="ghost" onPress={async () => { await logout(); router.replace("/(auth)/login"); }}
          icon={<SignOut color={colors.brandPrimary} size={18} weight="fill" />} testID="logout-btn" style={{ marginTop: spacing.md }} />
      </ScrollView>

      {/* Language modal */}
      <Modal visible={langModal} transparent animationType="slide" onRequestClose={() => setLangModal(false)}>
        <Pressable style={s.overlay} onPress={() => setLangModal(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.profile.language}</Display>
            {LANGUAGES.map((l) => (
              <Pressable key={l.code} style={[s.langRow, lang === l.code && s.langActive]} onPress={() => { setLang(l.code as Lang); setLangModal(false); }} testID={`lang-${l.code}`}>
                <Text style={s.langText}>{l.flag}  {l.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <Pressable style={s.overlay} onPress={() => setConfirmDelete(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Display size={font.xl}>{t.profile.deleteAccount}</Display>
            <Body muted>{t.profile.deleteConfirm}</Body>
            <Button title={t.profile.deleteAccount} variant="danger" onPress={doDelete} testID="confirm-delete" />
            <Button title={t.common.cancel} variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  headerCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 72, height: 72 },
  badges: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  premiumBadge: { backgroundColor: c.warning },
  adminBadge: { backgroundColor: c.success },
  badgeText: { color: c.onBrandTertiary, fontFamily: font.text, fontSize: font.sm, fontWeight: "700" },
  section: { color: c.onSurface, fontFamily: font.display, fontWeight: "700", fontSize: font.lg, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  rowLabel: { flex: 1, color: c.onSurface, fontFamily: font.text, fontSize: font.base, fontWeight: "500" },
  timeInput: { backgroundColor: c.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 40, minWidth: 80, color: c.onSurface, fontFamily: font.display, fontWeight: "700", textAlign: "center" },
  div: { height: 1, backgroundColor: c.divider },
  segWrap: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  segActive: { backgroundColor: c.brandPrimary },
  segText: { color: c.muted, fontFamily: font.text, fontWeight: "600", fontSize: font.sm },
  segTextActive: { color: c.onBrandPrimary },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  langRow: { padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary },
  langActive: { backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.brandPrimary },
  langText: { color: c.onSurface, fontFamily: font.text, fontSize: font.lg, fontWeight: "600" },
}));
