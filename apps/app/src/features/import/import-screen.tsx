import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isValidShareSlug, type Plan, type SharedSnapshot } from "@singsong/domain";
import { importSharedPlan, mutateActivePlan } from "@singsong/store";

import { fetchRemoteShare } from "@/lib/share-client";
import { useNativeStore } from "@/store/store-provider";
import { useAppTheme } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; payload: SharedSnapshot; expiresAt: string | null }
  | { kind: "error"; message: string };

function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (isValidShareSlug(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, "singsong://app");
    const candidate = url.pathname.split("/").filter(Boolean).at(-1) ?? url.hostname;
    return isValidShareSlug(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function ImportScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const initialParam = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const initialSlug = initialParam && isValidShareSlug(initialParam) ? initialParam : "";
  return <ImportScreenContent key={initialSlug} initialSlug={initialSlug} />;
}

function ImportScreenContent({ initialSlug }: { initialSlug: string }) {
  const native = useNativeStore();
  const { colors } = useAppTheme();
  const [input, setInput] = useState(initialSlug);
  const [request, setRequest] = useState(initialSlug ? { slug: initialSlug, sequence: 0 } : null);
  const [state, setState] = useState<LoadState>(
    initialSlug ? { kind: "loading" } : { kind: "idle" },
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ previous: Plan; importedRevision: number } | null>(null);

  useEffect(() => {
    if (!request) return;
    let active = true;
    void fetchRemoteShare(request.slug)
      .then((result) => {
        if (active) setState({ kind: "ready", ...result });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "티켓을 불러오지 못했습니다.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [request]);

  const summary = useMemo(() => {
    if (state.kind !== "ready") return null;
    const calculation = state.payload.calculation;
    return `${calculation.songCount}곡 · ${calculation.people}명`;
  }, [state]);

  function loadInput() {
    const next = extractSlug(input);
    if (!next) {
      setState({ kind: "error", message: "싱송 티켓 주소나 22자 티켓 코드를 확인해 주세요." });
      return;
    }
    setState({ kind: "loading" });
    setRequest((current) => ({
      slug: next,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  }

  function announce(message: string) {
    setStatus(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function performImport() {
    if (native.status !== "ready" || state.kind !== "ready" || !request || busy) return;
    const previous = native.plan;
    setBusy(true);
    try {
      const result = await importSharedPlan(
        native.store,
        native.plan.revision,
        request.slug,
        state.payload,
      );
      if (result.status === "already-imported") {
        announce("이미 이 기기에 가져온 티켓이에요.");
        return;
      }
      setUndo({ previous, importedRevision: result.plan.revision });
      announce("티켓의 곡 목록을 현재 플랜으로 가져왔어요.");
    } catch {
      announce("플랜이 바뀌었거나 티켓을 가져오지 못했어요. 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (native.status !== "ready" || state.kind !== "ready") return;
    if (native.plan.items.length === 0) {
      void performImport();
      return;
    }
    Alert.alert(
      "현재 플랜을 이 티켓으로 바꿀까요?",
      `지금 담긴 ${native.plan.items.length}곡을 바꿉니다. 가져온 직후에는 되돌릴 수 있어요.`,
      [
        { text: "취소", style: "cancel" },
        { text: "가져오기", onPress: () => void performImport() },
      ],
    );
  }

  async function undoImport() {
    if (native.status !== "ready" || !undo || busy) return;
    setBusy(true);
    try {
      await mutateActivePlan(native.store, undo.importedRevision, () => ({
        items: undo.previous.items,
        people: undo.previous.people,
        pricing: undo.previous.pricing,
      }));
      setUndo(null);
      announce("이전 플랜으로 되돌렸어요.");
    } catch {
      announce("플랜이 이미 바뀌어서 자동으로 되돌릴 수 없어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText }]}>TICKET HANDOFF</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            티켓 가져오기
          </Text>
          <Text style={[styles.help, { color: colors.inkMuted }]}>
            링크는 티켓 내용을 먼저 보여 줍니다. 확인하기 전에는 현재 플랜을 바꾸지 않아요.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={loadInput}
            placeholder="티켓 주소 또는 코드"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="티켓 주소 또는 코드"
            style={[
              styles.input,
              {
                color: colors.ink,
                borderColor: colors.borderControl,
                backgroundColor: colors.paper,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={loadInput}
            style={[styles.loadButton, { backgroundColor: colors.ink }]}
          >
            <Text style={{ color: colors.canvas, fontWeight: "800" }}>열기</Text>
          </Pressable>
        </View>

        {state.kind === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentText} />
            <Text style={{ color: colors.inkMuted }}>티켓을 확인하는 중…</Text>
          </View>
        ) : null}

        {state.kind === "error" ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.accentText }]}>
            {state.message}
          </Text>
        ) : null}

        {state.kind === "ready" ? (
          <View
            style={[
              styles.ticket,
              { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.ticketHead}>
              <View>
                <Text style={[styles.badge, { color: colors.accentText }]}>공유 티켓</Text>
                <Text style={[styles.summary, { color: colors.ink }]}>{summary}</Text>
              </View>
              <Text style={[styles.testData, { color: colors.inkMuted }]}>TEST DATA</Text>
            </View>
            {state.payload.items.map((track, index) => (
              <View key={`${track.title}-${index}`} style={styles.trackRow}>
                <Text style={[styles.index, { color: colors.inkMuted }]}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={styles.trackCopy}>
                  <Text style={[styles.trackTitle, { color: colors.ink }]}>{track.title}</Text>
                  <Text style={{ color: colors.inkMuted }}>{track.artist || "가수 미입력"}</Text>
                </View>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={busy || native.status !== "ready"}
              onPress={confirmImport}
              style={[
                styles.primary,
                { backgroundColor: colors.accentFill, opacity: busy ? 0.55 : 1 },
              ]}
            >
              <Text style={{ color: colors.onAccent, fontWeight: "900" }}>
                {busy ? "가져오는 중…" : "이 앱에 가져오기"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {undo ? (
          <View style={[styles.undo, { backgroundColor: colors.ink }]}>
            <Text style={{ color: colors.canvas, flex: 1 }}>티켓을 가져왔어요.</Text>
            <Pressable accessibilityRole="button" onPress={() => void undoImport()}>
              <Text style={{ color: colors.accentFill, fontWeight: "900" }}>되돌리기</Text>
            </Pressable>
          </View>
        ) : null}

        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.inkMuted }]}>
          {status}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 20, paddingBottom: 40, gap: 18 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: "900", marginTop: 2 },
  help: { marginTop: 6, fontSize: 14, lineHeight: 21 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 12,
  },
  loadButton: {
    minWidth: 68,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center", gap: 10, minHeight: 120 },
  error: { fontSize: 14, lineHeight: 21 },
  ticket: { borderWidth: 1, borderRadius: radius.ticket, padding: 16, gap: 10 },
  ticketHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  badge: { fontSize: 12, fontWeight: "900" },
  summary: { fontSize: 24, fontWeight: "900", marginTop: 2 },
  testData: { fontSize: 10, fontWeight: "800" },
  trackRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  index: { width: 28, fontVariant: ["tabular-nums"] },
  trackCopy: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: "800" },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: 8,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
  },
  undo: {
    minHeight: 56,
    borderRadius: radius.action,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  status: { minHeight: 22, fontSize: 13 },
});
