import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatKstDate, type TicketSnapshot } from "@singsong/domain";
import {
  deleteManagedShare,
  getManagedShare,
  listManagedShares,
  listTickets,
  type ManagedShareSummary,
} from "@singsong/store";

import { FlippableTicket } from "@/features/ticket/flippable-ticket";
import { revokeRemoteShare, shareLandingUrl } from "@/lib/share-client";
import { useNativeStore } from "@/store/store-provider";
import { useAppTheme, type AppColors } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";

type Segment = "sharing" | "completed";

type CollectionItem = {
  readonly ticket: TicketSnapshot;
  readonly share: ManagedShareSummary | null;
};

export function LibraryScreen() {
  const native = useNativeStore();
  const router = useRouter();
  const { scheme, colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [segment, setSegment] = useState<Segment>("sharing");
  const [refreshing, setRefreshing] = useState(false);
  const [busyFingerprint, setBusyFingerprint] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<CollectionItem>>(null);
  const activeIndexRef = useRef(0);
  const scrollX = useSharedValue(0);

  const refresh = useCallback(async () => {
    if (native.status !== "ready") return;
    setRefreshing(true);
    try {
      const [tickets, shares] = await Promise.all([
        listTickets(native.store),
        listManagedShares(native.store),
      ]);
      const shareByFingerprint = new Map(shares.map((share) => [share.fingerprint, share]));
      const nextItems = tickets.map((ticket) => ({
        ticket,
        share: shareByFingerprint.get(ticket.fingerprint) ?? null,
      }));
      const nextVisibleCount = nextItems.filter((item) =>
        segment === "sharing" ? item.share !== null : item.share === null,
      ).length;
      const nextActiveIndex = Math.min(activeIndexRef.current, Math.max(0, nextVisibleCount - 1));
      const nextCardWidth = Math.min(360, Math.max(260, windowWidth - 52));

      activeIndexRef.current = nextActiveIndex;
      setActiveIndex(nextActiveIndex);
      setItems(nextItems);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: nextActiveIndex * (nextCardWidth + 12),
          animated: false,
        });
      });
      setError(null);
    } catch {
      setError("보관한 티켓을 불러오지 못했어요.");
    } finally {
      setRefreshing(false);
    }
  }, [native, segment, windowWidth]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const sharing = useMemo(() => items.filter((item) => item.share !== null), [items]);
  const completed = useMemo(() => items.filter((item) => item.share === null), [items]);
  const shown = segment === "sharing" ? sharing : completed;
  const cardWidth = Math.min(360, Math.max(260, windowWidth - 52));
  const cardInterval = cardWidth + 12;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  function chooseSegment(next: Segment) {
    activeIndexRef.current = 0;
    setSegment(next);
    setActiveIndex(0);
    scrollX.value = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  async function copyLink(share: ManagedShareSummary) {
    if (!share.slug) return;
    try {
      await Clipboard.setStringAsync(shareLandingUrl(share.slug));
      setStatus("공유 링크를 복사했어요.");
    } catch {
      setStatus("공유 링크를 복사하지 못했어요.");
    }
  }

  function confirmRevoke(item: CollectionItem) {
    if (native.status !== "ready" || !item.share?.slug || busyFingerprint !== null) {
      return;
    }
    Alert.alert(
      "이 공유 링크를 폐기할까요?",
      "주소를 받은 사람도 더 이상 열 수 없습니다. 티켓은 완료 보관함에 남아요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "링크 폐기",
          style: "destructive",
          onPress: () => {
            if (native.status !== "ready" || !item.share?.slug) return;
            setBusyFingerprint(item.ticket.fingerprint);
            setStatus(null);
            void getManagedShare(native.store, item.ticket.fingerprint)
              .then(async (capability) => {
                if (!capability) {
                  throw new Error(
                    "이 기기에 철회 키가 없어 폐기할 수 없어요. 만료 시각까지 유지됩니다.",
                  );
                }
                await revokeRemoteShare(item.share!.slug!, capability.revokeToken);
                await deleteManagedShare(native.store, item.ticket.fingerprint);
              })
              .then(async () => {
                setStatus("링크를 폐기하고 완료 보관함으로 옮겼어요.");
                await refresh();
              })
              .catch((caught: unknown) => {
                setStatus(
                  caught instanceof Error ? caught.message : "공유 링크를 폐기하지 못했어요.",
                );
              })
              .finally(() => setBusyFingerprint(null));
          },
        },
      ],
    );
  }

  if (native.status === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accentText} />
      </SafeAreaView>
    );
  }

  if (native.status === "error") {
    return (
      <SafeAreaView style={styles.center}>
        <Text accessibilityRole="alert" style={{ color: colors.ink }}>
          보관함 저장소를 열지 못했어요.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accentText }]}>SESSION COLLECTION</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            보관함
          </Text>
          <Text style={[styles.help, { color: colors.inkMuted }]}>
            발권한 순간의 곡 순서와 계산은 바뀌지 않아요.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.accentText }}>
              {error}
            </Text>
          ) : null}
        </View>

        <View accessibilityRole="radiogroup" style={styles.segments}>
          <SegmentButton
            colors={colors}
            count={sharing.length}
            label="공유 중"
            onPress={() => chooseSegment("sharing")}
            selected={segment === "sharing"}
          />
          <SegmentButton
            colors={colors}
            count={completed.length}
            label="완료"
            onPress={() => chooseSegment("completed")}
            selected={segment === "completed"}
          />
        </View>

        {shown.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.borderSubtle }]}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>
              {segment === "sharing"
                ? "지금 공유 중인 세션이 없어요."
                : "아직 완료된 세션이 없어요."}
            </Text>
            <Text style={[styles.help, { color: colors.inkMuted }]}>
              플랜에서 티켓을 만들면 이 기기의 보관함에 쌓입니다.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/")}
              style={[styles.primary, { backgroundColor: colors.accentFill }]}
            >
              <Text style={[styles.primaryText, { color: colors.onAccent }]}>플랜으로 가기</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Animated.FlatList
              ref={listRef}
              accessibilityLabel={`${segment === "sharing" ? "공유 중" : "완료"} 티켓 목록`}
              contentContainerStyle={styles.carouselContent}
              data={shown}
              decelerationRate="fast"
              horizontal
              keyExtractor={(item) => `${item.ticket.planId}:${item.ticket.revision}`}
              onMomentumScrollEnd={(event) => {
                const next = Math.max(
                  0,
                  Math.min(
                    shown.length - 1,
                    Math.round(event.nativeEvent.contentOffset.x / cardInterval),
                  ),
                );
                activeIndexRef.current = next;
                setActiveIndex(next);
                AccessibilityInfo.announceForAccessibility(
                  `${next + 1}번째 티켓, 전체 ${shown.length}장`,
                );
              }}
              onScroll={onScroll}
              renderItem={({ item, index }) => (
                <CollectionCard
                  active={index === activeIndex}
                  busy={busyFingerprint === item.ticket.fingerprint}
                  cardInterval={cardInterval}
                  cardWidth={cardWidth}
                  colors={colors}
                  index={index}
                  item={item}
                  onCopy={() => item.share && void copyLink(item.share)}
                  onOpen={() => router.push(`/ticket/${String(item.ticket.revision)}` as Href)}
                  onRevoke={() => confirmRevoke(item)}
                  scheme={scheme}
                  scrollX={scrollX}
                />
              )}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={cardInterval}
              style={{ height: cardWidth / 0.8 + 190 }}
            />
            {shown.length > 1 ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[styles.progress, { color: colors.inkMuted }]}
              >
                {activeIndex + 1} / {shown.length} · 좌우로 넘겨 보세요
              </Text>
            ) : null}
          </>
        )}

        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.inkMuted }]}>
          {status}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CollectionCard({
  active,
  busy,
  cardInterval,
  cardWidth,
  colors,
  index,
  item,
  onCopy,
  onOpen,
  onRevoke,
  scheme,
  scrollX,
}: {
  active: boolean;
  busy: boolean;
  cardInterval: number;
  cardWidth: number;
  colors: AppColors;
  index: number;
  item: CollectionItem;
  onCopy: () => void;
  onOpen: () => void;
  onRevoke: () => void;
  scheme: "light" | "dark";
  scrollX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * cardInterval, index * cardInterval, (index + 1) * cardInterval];
    return {
      opacity: interpolate(scrollX.value, input, [0.62, 1, 0.62], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(scrollX.value, input, [0.94, 1, 0.94], Extrapolation.CLAMP),
        },
      ],
    };
  }, [cardInterval, index]);

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[
        styles.collectionCard,
        {
          width: cardWidth,
          backgroundColor: colors.paper,
          borderColor: colors.borderSubtle,
        },
        animatedStyle,
      ]}
    >
      <FlippableTicket
        animateIssue={false}
        theme={scheme}
        ticket={item.ticket}
        width={cardWidth - 28}
      />
      {item.share ? (
        <View style={styles.shareStrip}>
          <Text style={[styles.shareMeta, { color: colors.inkMuted }]}>
            공유 중 · 만료{" "}
            {item.share.expiresAt ? formatKstDate(item.share.expiresAt) : "확인 불가"}
          </Text>
          <View style={styles.cardActions}>
            <SmallAction colors={colors} disabled={busy} label="링크 복사" onPress={onCopy} />
            <SmallAction
              colors={colors}
              disabled={busy || !item.share.canRevoke}
              label={busy ? "폐기 중…" : "링크 폐기"}
              onPress={onRevoke}
            />
          </View>
        </View>
      ) : (
        <View style={styles.archiveStrip}>
          <Text style={[styles.shareMeta, { color: colors.inkMuted }]}>
            {formatKstDate(item.ticket.createdAt)} 발권 · REV {item.ticket.revision}
          </Text>
          <SmallAction colors={colors} disabled={false} label="티켓 열기" onPress={onOpen} />
        </View>
      )}
    </Animated.View>
  );
}

function SegmentButton({
  colors,
  count,
  label,
  onPress,
  selected,
}: {
  colors: AppColors;
  count: number;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.segment,
        {
          backgroundColor: selected ? colors.ink : colors.paper,
          borderColor: selected ? colors.ink : colors.borderControl,
        },
      ]}
    >
      <Text style={{ color: selected ? colors.canvas : colors.ink, fontWeight: "800" }}>
        {label} {count}
      </Text>
    </Pressable>
  );
}

function SmallAction({
  colors,
  disabled,
  label,
  onPress,
}: {
  colors: AppColors;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.smallAction,
        { borderColor: colors.borderControl, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={{ color: colors.ink, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingTop: 20, paddingBottom: 40, gap: 14 },
  header: { paddingHorizontal: 20, gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: "900" },
  help: { fontSize: 14, lineHeight: 21 },
  segments: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselContent: { paddingHorizontal: 20, gap: 12 },
  collectionCard: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.ticket,
    padding: 13,
    gap: 12,
  },
  shareStrip: { gap: 10 },
  archiveStrip: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  shareMeta: { flex: 1, fontSize: 12, lineHeight: 18 },
  cardActions: { flexDirection: "row", gap: 8 },
  smallAction: {
    minHeight: MIN_TOUCH_TARGET,
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  progress: { textAlign: "center", fontSize: 12 },
  empty: {
    minHeight: 260,
    marginHorizontal: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.strip,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  primaryText: { fontWeight: "900" },
  status: { minHeight: 22, marginHorizontal: 20, fontSize: 13, lineHeight: 20 },
});
