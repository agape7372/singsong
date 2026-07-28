import { useRouter, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Asset, requestPermissionsAsync } from "expo-media-library/next";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatKstDateTime, type Plan, type TicketSnapshot } from "@singsong/domain";
import {
  completeManagedShare,
  deleteManagedShare,
  getActivePlan,
  getManagedShare,
  prepareManagedShare,
  rotateManagedShare,
  type ManagedShare,
} from "@singsong/store";

import { FlippableTicket } from "./flippable-ticket";
import { issueOrLoadTicket, parseTicketRevision, type TicketResolution } from "./ticket-repository";
import {
  createRemoteShare,
  revokeRemoteShare,
  shareLandingUrl,
  ShareApiError,
} from "@/lib/share-client";
import { exportTicketPng } from "@/render/skia/export-ticket";
import { nativeDomainPorts } from "@/store/native-ports";
import { useNativeStore } from "@/store/store-provider";
import { useAppTheme, type AppColors } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET } from "@/theme/tokens";

type ScreenState =
  | { readonly status: "loading"; readonly key: null }
  | { readonly status: "missing"; readonly key: string; readonly revision: number }
  | { readonly status: "error"; readonly key: string; readonly error: Error }
  | {
      readonly status: "ready";
      readonly key: string;
      readonly ticket: TicketSnapshot;
      readonly issued: boolean;
      readonly animateIssue: boolean;
    };

type BusyAction = "gallery" | "share" | "link" | "revoke" | null;
type Notice = { readonly tone: "info" | "error"; readonly message: string };

class StaleTicketError extends Error {}
class GalleryPermissionError extends Error {}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function TicketScreen({ revisionParam }: { revisionParam: string | string[] | undefined }) {
  const router = useRouter();
  const native = useNativeStore();
  const { scheme: colorScheme, colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const parsedRevision = parseTicketRevision(revisionParam);
  const requestedRevision = parsedRevision.revision;
  const store = native.status === "ready" ? native.store : null;
  const plan = native.status === "ready" ? native.plan : null;
  const [state, setState] = useState<ScreenState>({ status: "loading", key: null });
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [managedShare, setManagedShare] = useState<ManagedShare | null>(null);
  const latestPlan = useRef<Plan | null>(plan);

  useEffect(() => {
    latestPlan.current = plan;
  }, [plan]);

  useEffect(() => {
    if (!parsedRevision.valid) return;
    if (!store || !plan) return;
    let active = true;
    const fallbackKey = `${plan.id}:${requestedRevision ?? plan.revision}`;

    void (async () => {
      // The mutation promise can resolve before the provider's observer emits.
      // Re-read the committed plan so this route can never freeze a stale
      // revision during that window.
      const committedPlan = await getActivePlan(store);
      const loadKey = `${committedPlan.id}:${requestedRevision ?? committedPlan.revision}`;
      const resolution: TicketResolution = await issueOrLoadTicket({
        store,
        plan: committedPlan,
        ...(requestedRevision === undefined ? {} : { requestedRevision }),
        ports: nativeDomainPorts,
      });
      return { loadKey, resolution };
    })()
      .then(({ loadKey, resolution }) => {
        if (!active) return;
        setNotice(null);
        if (resolution.status === "missing") {
          setState({ status: "missing", key: loadKey, revision: resolution.revision });
          return;
        }
        setState({
          status: "ready",
          key: loadKey,
          ticket: resolution.ticket,
          issued: resolution.issued,
          animateIssue: resolution.animateIssue,
        });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: "error", key: fallbackKey, error: normalizeError(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [parsedRevision.valid, plan, requestedRevision, store]);

  useEffect(() => {
    if (!store || state.status !== "ready") return;
    let active = true;
    void getManagedShare(store, state.ticket.fingerprint)
      .then((share) => {
        if (active) setManagedShare(share);
      })
      .catch(() => {
        if (active) setManagedShare(null);
      });
    return () => {
      active = false;
    };
  }, [state, store]);

  function assertCurrent(ticket: TicketSnapshot) {
    const current = latestPlan.current;
    if (!current || current.id !== ticket.planId || current.revision !== ticket.revision) {
      throw new StaleTicketError(
        "플랜이 수정되어 이 티켓의 저장·공유를 멈췄어요. 현재 revision 티켓을 열어 주세요.",
      );
    }
  }

  async function runAction(
    action: Exclude<BusyAction, null>,
    ticket: TicketSnapshot,
    task: (fileUri: string) => Promise<void>,
  ) {
    if (busyAction) return;
    setBusyAction(action);
    setNotice(null);
    try {
      assertCurrent(ticket);
      await nextFrame();
      const file = await exportTicketPng(ticket);
      assertCurrent(ticket);
      await task(file.uri);
    } catch (error) {
      const normalized = normalizeError(error);
      const message =
        normalized instanceof GalleryPermissionError
          ? normalized.message
          : normalized instanceof StaleTicketError
            ? normalized.message
            : "티켓 이미지를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
      setNotice({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  }

  function saveToGallery(ticket: TicketSnapshot) {
    return runAction("gallery", ticket, async (fileUri) => {
      const permission = await requestPermissionsAsync(true, []);
      if (!permission.granted) {
        throw new GalleryPermissionError(
          "사진 추가 권한이 없어 저장하지 못했어요. 기기 설정에서 사진 권한을 허용해 주세요.",
        );
      }
      assertCurrent(ticket);
      await Asset.create(fileUri);
      setNotice({ tone: "info", message: "1080×1350 티켓을 갤러리에 저장했어요." });
    });
  }

  function shareTicket(ticket: TicketSnapshot) {
    return runAction("share", ticket, async (fileUri) => {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("이 기기에서는 공유 시트를 열 수 없어요.");
      }
      assertCurrent(ticket);
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "싱송 티켓 공유",
      });
      setNotice({ tone: "info", message: "기기 공유 시트를 열었어요." });
    });
  }

  async function createLink(ticket: TicketSnapshot) {
    if (!store || busyAction) return;
    setBusyAction("link");
    setNotice(null);
    try {
      assertCurrent(ticket);
      let pending = await prepareManagedShare(store, ticket.fingerprint);
      let created;
      try {
        created = await createRemoteShare(ticket, pending);
      } catch (error) {
        if (!(error instanceof ShareApiError) || error.code !== "IDEMPOTENCY_CONFLICT") {
          throw error;
        }
        pending = await rotateManagedShare(store, ticket.fingerprint);
        created = await createRemoteShare(ticket, pending);
      }
      let completed: ManagedShare;
      try {
        completed = await completeManagedShare(store, ticket.fingerprint, created);
      } catch (completionError) {
        // 서버 발급 뒤 로컬 영수증 저장이 실패하면 30일짜리 고아 링크를 남기지 않는다.
        await revokeRemoteShare(created.slug, created.revokeToken).catch(() => undefined);
        throw completionError;
      }
      setManagedShare(completed);
      await Clipboard.setStringAsync(shareLandingUrl(created.slug));
      setNotice({ tone: "info", message: "공유 링크를 만들고 클립보드에 복사했어요." });
    } catch (error) {
      const message =
        error instanceof StaleTicketError
          ? error.message
          : error instanceof Error
            ? error.message
            : "공유 링크를 만들지 못했어요.";
      setNotice({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  }

  async function copyLink(share: ManagedShare) {
    if (!share.slug) return;
    try {
      await Clipboard.setStringAsync(shareLandingUrl(share.slug));
      setNotice({ tone: "info", message: "공유 링크를 복사했어요." });
    } catch {
      setNotice({ tone: "error", message: "공유 링크를 복사하지 못했어요." });
    }
  }

  async function shareLink(share: ManagedShare) {
    if (!share.slug) return;
    try {
      await NativeShare.share({
        title: "싱송 티켓",
        message: `싱송 티켓을 확인해 보세요.\n${shareLandingUrl(share.slug)}`,
      });
    } catch {
      setNotice({ tone: "error", message: "링크 공유 시트를 열지 못했어요." });
    }
  }

  function confirmRevokeLink(ticket: TicketSnapshot, share: ManagedShare) {
    if (!store || !share.slug || busyAction) return;
    Alert.alert("공유 링크를 폐기할까요?", "폐기하면 같은 주소로 티켓을 다시 열 수 없습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "링크 폐기",
        style: "destructive",
        onPress: () => {
          setBusyAction("revoke");
          setNotice(null);
          void revokeRemoteShare(share.slug!, share.revokeToken)
            .then(() => deleteManagedShare(store, ticket.fingerprint))
            .then(() => {
              setManagedShare(null);
              setNotice({ tone: "info", message: "공유 링크를 폐기했어요." });
            })
            .catch((error: unknown) => {
              setNotice({
                tone: "error",
                message: error instanceof Error ? error.message : "공유 링크를 폐기하지 못했어요.",
              });
            })
            .finally(() => setBusyAction(null));
        },
      },
    ]);
  }

  if (!parsedRevision.valid) {
    return (
      <TicketState
        title="revision 주소가 올바르지 않아요."
        body="티켓 주소를 다시 확인하거나 현재 플랜으로 돌아가 주세요."
        actionLabel="플랜으로"
        onAction={() => router.replace("/")}
      />
    );
  }

  if (native.status === "error") {
    return (
      <TicketState
        title="티켓 저장소를 열 수 없어요."
        body="기기 저장 공간을 확인한 뒤 다시 시도해 주세요."
        actionLabel="플랜으로"
        onAction={() => router.replace("/")}
      />
    );
  }

  if (native.status === "loading" || state.status === "loading") {
    return (
      <TicketState
        title="티켓을 준비하는 중…"
        body="이 revision의 동결 스냅샷을 확인하고 있어요."
      />
    );
  }

  const currentLoadKey = plan ? `${plan.id}:${requestedRevision ?? plan.revision}` : null;
  if (state.key !== currentLoadKey) {
    return (
      <TicketState
        title="티켓을 준비하는 중…"
        body="이 revision의 동결 스냅샷을 확인하고 있어요."
      />
    );
  }

  if (state.status === "missing") {
    return (
      <TicketState
        title={`revision ${state.revision} 티켓이 없어요.`}
        body="보관 티켓은 이미 발급된 동결 스냅샷만 불러올 수 있어요."
        actionLabel="현재 티켓 보기"
        onAction={() => router.replace("/ticket" as Href)}
      />
    );
  }

  if (state.status === "error") {
    return (
      <TicketState
        title="이 플랜으로 티켓을 만들 수 없어요."
        body="곡을 한 개 이상 담고 인원과 요금을 올바르게 입력한 뒤 다시 시도해 주세요."
        actionLabel="플랜 고치기"
        onAction={() => router.replace("/")}
      />
    );
  }

  const ticket = state.ticket;
  const stale = !plan || plan.id !== ticket.planId || plan.revision !== ticket.revision;
  const ticketWidth = Math.min(400, Math.max(220, windowWidth - 32));
  const busy = busyAction !== null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 화면"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { borderColor: colors.borderControl, opacity: pressed ? 0.62 : 1 },
          ]}
        >
          <Text style={[styles.backGlyph, { color: colors.ink }]}>‹</Text>
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>
            세션 티켓
          </Text>
          <Text style={[styles.revision, { color: colors.inkMuted }]}>
            REV {ticket.revision} · {ticket.fingerprint.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {stale ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.banner,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.ink }]}>
              보관된 revision입니다. 현재 플랜과 달라 저장·공유는 잠겨 있어요.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/ticket" as Href)}
              style={({ pressed }) => [styles.bannerAction, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.bannerActionText, { color: colors.accentText }]}>현재 티켓</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.flipHint, { color: colors.inkMuted }]}>
            티켓의 상세 버튼을 누르면 전체 곡과 계산 상세가 보여요.
          </Text>
        )}

        <FlippableTicket
          ticket={ticket}
          theme={colorScheme}
          width={ticketWidth}
          animateIssue={state.animateIssue}
        />

        <View style={styles.actions}>
          <ActionButton
            label={busyAction === "gallery" ? "PNG 만드는 중…" : "갤러리에 저장"}
            disabled={stale || busy}
            onPress={() => void saveToGallery(ticket)}
            colors={colors}
          />
          <ActionButton
            label={busyAction === "share" ? "PNG 만드는 중…" : "OS로 공유"}
            disabled={stale || busy}
            onPress={() => void shareTicket(ticket)}
            primary
            colors={colors}
          />
        </View>

        <View
          style={[
            styles.linkCard,
            { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.linkTitle, { color: colors.ink }]}>링크로 건네기</Text>
          {managedShare?.slug ? (
            <>
              <Text selectable style={[styles.linkUrl, { color: colors.accentText }]}>
                {shareLandingUrl(managedShare.slug)}
              </Text>
              <Text style={[styles.linkExpiry, { color: colors.inkMuted }]}>
                {managedShare.expiresAt
                  ? `${formatKstDateTime(managedShare.expiresAt)}까지 열 수 있어요.`
                  : "만료 시각을 확인할 수 없어요."}
              </Text>
              <View style={styles.linkActions}>
                <ActionButton
                  label="복사"
                  disabled={busy}
                  onPress={() => void copyLink(managedShare)}
                  colors={colors}
                />
                <ActionButton
                  label="링크 공유"
                  disabled={busy}
                  onPress={() => void shareLink(managedShare)}
                  primary
                  colors={colors}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => confirmRevokeLink(ticket, managedShare)}
                style={({ pressed }) => [
                  styles.revokeButton,
                  { opacity: busy ? 0.4 : pressed ? 0.62 : 1 },
                ]}
              >
                <Text style={{ color: colors.accentText, fontWeight: "800" }}>
                  {busyAction === "revoke" ? "폐기하는 중…" : "이 링크 폐기"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.linkDescription, { color: colors.inkMuted }]}>
                티켓 스냅샷만 서버에 30일간 보관합니다. 프로필 사진은 포함하지 않아요.
              </Text>
              <ActionButton
                label={busyAction === "link" ? "링크 만드는 중…" : "공유 링크 만들기"}
                disabled={stale || busy}
                onPress={() => void createLink(ticket)}
                primary
                colors={colors}
              />
            </>
          )}
        </View>

        {notice ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              { color: notice.tone === "error" ? colors.accentText : colors.ink },
            ]}
          >
            {notice.message}
          </Text>
        ) : null}
        <Text style={[styles.privateNote, { color: colors.inkMuted }]}>
          PNG는 기기 안에서만 만들며 서버로 전송하지 않아요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
  primary = false,
  colors,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  primary?: boolean;
  colors: AppColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? colors.accentFill : colors.paper,
          borderColor: primary ? colors.accentFill : colors.borderControl,
          opacity: disabled ? 0.42 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.onAccent : colors.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TicketState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.stateSafeArea, { backgroundColor: colors.canvas }]}>
      <View
        style={[
          styles.stateCard,
          { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.ink }]}>
          {title}
        </Text>
        <Text style={[styles.stateBody, { color: colors.inkMuted }]}>{body}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [
              styles.stateAction,
              { backgroundColor: colors.accentFill, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.stateActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
  },
  backGlyph: { marginTop: -4, fontSize: 34, lineHeight: 38, fontWeight: "400" },
  backButtonSpacer: { width: MIN_TOUCH_TARGET },
  topBarCopy: { alignItems: "center" },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  revision: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    fontVariant: ["tabular-nums"],
  },
  scroll: { flex: 1 },
  content: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  flipHint: { marginBottom: 9, fontSize: 12, lineHeight: 17 },
  banner: {
    width: "100%",
    maxWidth: 400,
    minHeight: 48,
    marginBottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  bannerAction: {
    minHeight: 38,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerActionText: { fontSize: 12, fontWeight: "900" },
  actions: {
    width: "100%",
    maxWidth: 400,
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  linkCard: {
    width: "100%",
    maxWidth: 400,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 10,
  },
  linkTitle: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  linkDescription: { fontSize: 13, lineHeight: 19 },
  linkUrl: { fontSize: 12, lineHeight: 18 },
  linkExpiry: { fontSize: 11, lineHeight: 16 },
  linkActions: { flexDirection: "row", gap: 10 },
  revokeButton: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    minHeight: MIN_TOUCH_TARGET,
    flex: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  actionText: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  notice: {
    width: "100%",
    maxWidth: 400,
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  privateNote: {
    width: "100%",
    maxWidth: 400,
    marginTop: 10,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
  },
  stateSafeArea: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stateCard: {
    width: "100%",
    maxWidth: 420,
    padding: 22,
    borderWidth: 1,
    borderRadius: 18,
  },
  stateTitle: { fontSize: 22, lineHeight: 29, fontWeight: "900" },
  stateBody: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  stateAction: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  stateActionText: { color: "#15131a", fontSize: 15, fontWeight: "900" },
});
