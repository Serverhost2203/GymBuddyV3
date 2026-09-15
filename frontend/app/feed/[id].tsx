import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, Check, Heart, PaperPlaneRight, PencilSimple, Trash, Trophy, User as UserIcon, X } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Body, Card, Display, Skeleton } from "@/src/components/ui";
import { useApp } from "@/src/context";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function PostDetail() {
  const { t, user } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const q = useQuery({ queryKey: ["post", id], queryFn: () => api.get(`/posts/${id}`) });
  const p = q.data;
  const isAdmin = user?.role === "admin";

  const like = async () => { await api.post(`/posts/${id}/like`, {}); q.refetch(); qc.invalidateQueries({ queryKey: ["feed"] }); };
  const send = async () => { if (!comment.trim()) return; await api.post(`/posts/${id}/comments`, { text: comment }); setComment(""); q.refetch(); };
  const saveEdit = async (cid: string) => {
    if (!editText.trim()) return;
    await api.put(`/posts/${id}/comments/${cid}`, { text: editText });
    setEditingId(null); setEditText(""); q.refetch();
  };
  const removeComment = (cid: string) => {
    const doDelete = async () => {
      await api.del(`/posts/${id}/comments/${cid}`);
      q.refetch(); qc.invalidateQueries({ queryKey: ["feed"] });
    };
    if (Platform.OS === "web") {
      if (window.confirm(t.feed.deleteCommentConfirm)) doDelete();
      return;
    }
    Alert.alert(t.feed.deleteComment, t.feed.deleteCommentConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.feed.deleteComment, style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="post-back"><CaretLeft color={colors.onSurface} size={26} /></Pressable>
        <Display size={font.lg}>{t.feed.comments}</Display>
      </View>
      {q.isLoading || !p ? <View style={{ padding: spacing.lg }}><Skeleton height={160} /></View> : (
        <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }} bottomOffset={20}>
          <Card>
            <Pressable style={s.postHead} onPress={() => router.push(`/profile/${p.author.id}`)}>
              <View style={s.avatar}>{p.author.avatar ? <Image source={{ uri: p.author.avatar }} style={s.avatarImg} /> : <UserIcon color={colors.muted} size={20} weight="fill" />}</View>
              <Body style={{ fontWeight: "700", flex: 1 }}>{p.author.name}</Body>
              {p.type === "record" ? <Trophy color={colors.brandPrimary} size={20} weight="fill" /> : null}
            </Pressable>
            {p.text ? <Body style={{ marginTop: spacing.sm }}>{p.text}</Body> : null}
            {p.image ? <Image source={{ uri: p.image }} style={s.postImg} contentFit="cover" /> : null}
            <Pressable style={s.likeRow} onPress={like} testID="post-like">
              <Heart color={p.liked ? colors.error : colors.muted} size={22} weight={p.liked ? "fill" : "regular"} />
              <Text style={s.likeText}>{p.likes}</Text>
            </Pressable>
          </Card>

          {(p.comment_list ?? []).map((c: any) => {
            const canManage = !!user && (c.user_id === user.id || isAdmin);
            const editing = editingId === c.id;
            return (
              <View key={c.id} style={s.commentRow} testID={`comment-${c.id}`}>
                <View style={s.avatarSm}>{c.author.avatar ? <Image source={{ uri: c.author.avatar }} style={s.avatarSmImg} /> : <UserIcon color={colors.muted} size={16} weight="fill" />}</View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }} size={font.sm}>{c.author.name}</Body>
                  {editing ? (
                    <View style={s.editRow}>
                      <TextInput style={s.editInput} value={editText} onChangeText={setEditText} multiline autoFocus testID="comment-edit-input" />
                      <Pressable onPress={() => saveEdit(c.id)} hitSlop={8} testID="comment-edit-save"><Check color={colors.success} size={20} weight="bold" /></Pressable>
                      <Pressable onPress={() => setEditingId(null)} hitSlop={8} testID="comment-edit-cancel"><X color={colors.muted} size={20} weight="bold" /></Pressable>
                    </View>
                  ) : (
                    <Body>{c.text}{c.edited_at ? <Text style={s.editedMark}> · {t.feed.edited}</Text> : null}</Body>
                  )}
                </View>
                {canManage && !editing ? (
                  <View style={s.actions}>
                    <Pressable onPress={() => { setEditingId(c.id); setEditText(c.text); }} hitSlop={8} testID={`comment-edit-${c.id}`}>
                      <PencilSimple color={colors.muted} size={18} />
                    </Pressable>
                    <Pressable onPress={() => removeComment(c.id)} hitSlop={8} testID={`comment-delete-${c.id}`}>
                      <Trash color={colors.error} size={18} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      )}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput style={s.input} value={comment} onChangeText={setComment} placeholder={t.feed.addComment} placeholderTextColor={colors.muted} testID="comment-input" />
        <Pressable style={s.send} onPress={send} testID="comment-send"><PaperPlaneRight color={colors.onBrandPrimary} size={20} weight="fill" /></Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarSmImg: { width: 32, height: 32 },
  postImg: { width: "100%", height: 220, borderRadius: radius.md, marginTop: spacing.sm },
  likeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  likeText: { color: c.muted, fontFamily: font.text, fontWeight: "600" },
  commentRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  actions: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingTop: 2 },
  editRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.xs },
  editInput: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: c.onSurface, fontFamily: font.text },
  editedMark: { color: c.muted, fontSize: font.sm, fontFamily: font.text },
  inputBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center" },
  input: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 46, color: c.onSurface, fontFamily: font.text },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
