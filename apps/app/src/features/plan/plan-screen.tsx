import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { PricingConfig, Track } from "@singsong/domain";

import { AppText, Button, EmptyState, ScreenHeader, UndoBar } from "@/components/ui";
import { CalculationPanel, type CalculationPanelHandle } from "@/features/plan/calculation-panel";
import { moveTrack, removeTrack, restoreTrack } from "@/features/plan/plan-mutations";
import { ticketRevisionHref } from "@/features/plan/ticket-navigation";
import { TrackRow } from "@/features/plan/track-row";
import { usePlanEditor } from "@/features/plan/use-plan-editor";
import { useA11yAnnounce } from "@/lib/a11y";
import { useToast } from "@/lib/toast";
import { retryNativeStoreInitialization } from "@/store/store-provider";
import { useAppTheme } from "@/theme/theme-provider";

type RemovedTrack = {
  readonly track: Track;
  readonly index: number;
};

export function PlanScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const announce = useA11yAnnounce();
  const { showToast } = useToast();
  const { snapshot, plan, isSaving, getPlan, mutate } = usePlanEditor();
  const listRef = useRef<FlatList<Track>>(null);
  const calculationRef = useRef<CalculationPanelHandle>(null);
  const [removed, setRemoved] = useState<RemovedTrack | null>(null);

  const openSearch = useCallback(() => {
    router.push("/search" as Href);
  }, []);

  const issueCurrent = useCallback(() => {
    const href = ticketRevisionHref(getPlan());
    if (!href) {
      showToast("곡과 가격·인원 설정을 확인한 뒤 다시 발권해 주세요.");
      return;
    }
    router.push(href as Href);
  }, [getPlan, showToast]);

  const move = useCallback(
    async (trackId: string, direction: -1 | 1) => {
      if (!plan || isSaving) return;
      try {
        const next = await mutate((current) => moveTrack(current, trackId, direction));
        const nextIndex = next.items.findIndex((item) => item.id === trackId);
        setRemoved(null);
        announce(`${nextIndex + 1}번째로 이동했습니다.`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "곡 순서를 바꾸지 못했습니다.");
      }
    },
    [announce, isSaving, mutate, plan, showToast],
  );

  const remove = useCallback(
    async (trackId: string) => {
      const latest = getPlan();
      if (!latest || isSaving) return;
      const index = latest.items.findIndex((item) => item.id === trackId);
      const track = latest.items[index];
      if (!track) return;
      try {
        await mutate((current) => removeTrack(current, trackId));
        setRemoved({ track, index });
        announce(`‘${track.title}’을 삭제했습니다. 되돌릴 수 있습니다.`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "곡을 삭제하지 못했습니다.");
      }
    },
    [announce, getPlan, isSaving, mutate, showToast],
  );

  async function undoRemove() {
    if (!removed || isSaving) return;
    try {
      await mutate((current) => restoreTrack(current, removed.track, removed.index));
      announce(`‘${removed.track.title}’을 되돌렸습니다.`);
      setRemoved(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제를 되돌리지 못했습니다.");
    }
  }

  async function applyCalculation(people: number, pricing: PricingConfig): Promise<boolean> {
    if (!plan || isSaving) return false;
    try {
      await mutate((current) => ({
        items: current.items,
        people,
        pricing,
      }));
      setRemoved(null);
      announce("가격과 인원 계산을 적용했습니다.");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "가격과 인원을 저장하지 못했습니다.");
      return false;
    }
  }

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        count={plan?.items.length ?? 0}
        disabled={isSaving}
        index={index}
        onMove={(direction) => void move(item.id, direction)}
        onRemove={() => void remove(item.id)}
        track={item}
      />
    ),
    [isSaving, move, plan?.items.length, remove],
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <ScreenHeader
          eyebrow="SINGSONG · SESSION"
          title="오늘의 플랜"
          subtitle="부를 순서대로 곡을 담고, 시간과 비용을 한 번에 계산해요."
          status={isSaving ? "이 기기에 저장 중…" : "이 기기에 자동 저장"}
          action={<Button compact disabled={isSaving} label="곡 담기" onPress={openSearch} />}
        />
        {plan && plan.items.length > 0 ? (
          <View
            style={[
              styles.countStrip,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.countCopy}>
              <AppText variant="label">부를 순서</AppText>
              <AppText muted variant="caption">
                위·아래 버튼 또는 TalkBack 조절 동작으로 순서를 바꿉니다.
              </AppText>
            </View>
            <AppText variant="title">{plan.items.length}곡</AppText>
          </View>
        ) : null}
      </View>
    ),
    [colors.borderSubtle, colors.surfaceMuted, isSaving, openSearch, plan],
  );

  if (snapshot.status === "error") {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <View accessibilityRole="alert" style={styles.loading}>
          <AppText accessibilityRole="header" variant="title">
            플랜을 열지 못했습니다.
          </AppText>
          <AppText muted>{snapshot.error.message}</AppText>
          <Button label="다시 시도" onPress={() => void retryNativeStoreInitialization()} />
        </View>
      </SafeAreaView>
    );
  }

  if (snapshot.status === "loading" || !plan) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.accentText} size="large" />
          <AppText variant="title">이 기기의 플랜을 여는 중…</AppText>
          <AppText muted>저장된 곡 순서와 가격표를 확인하고 있습니다.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const pricingKey =
    plan.pricing?.kind === "song"
      ? `song-${plan.pricing.singlePriceWon}-${plan.pricing.bundle?.songs ?? ""}-${plan.pricing.bundle?.priceWon ?? ""}`
      : plan.pricing
        ? `time-${plan.pricing.blockSeconds}-${plan.pricing.blockPriceWon}`
        : "unset";

  const footer =
    plan.items.length > 0 ? (
      <CalculationPanel
        key={`${plan.people ?? "unset"}-${pricingKey}`}
        ref={calculationRef}
        disabled={isSaving}
        listRef={listRef}
        onApply={applyCalculation}
        onIssue={issueCurrent}
        plan={plan}
      />
    ) : null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <KeyboardAvoidingView automaticOffset behavior="padding" style={styles.keyboard}>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.content}
          data={plan.items}
          ItemSeparatorComponent={TrackSeparator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState
              action={<Button label="첫 곡 담기" onPress={openSearch} />}
              description="곡을 담으면 예상 시간·전체 비용·1인당 금액을 바로 계산할 수 있어요."
              title="아직 부를 곡이 없어요."
            />
          }
          ListFooterComponent={footer}
          ListHeaderComponent={header}
          renderItem={renderItem}
        />
      </KeyboardAvoidingView>
      {removed ? (
        <View style={[styles.undoOverlay, { bottom: Math.max(12, insets.bottom + 8) }]}>
          <UndoBar
            disabled={isSaving}
            message={`‘${removed.track.title}’을 삭제했습니다.`}
            onAction={() => void undoRemove()}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TrackSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  header: { gap: 12, paddingBottom: 14 },
  countStrip: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  countCopy: { flex: 1, gap: 2 },
  separator: { height: 10 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  undoOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
  },
});
