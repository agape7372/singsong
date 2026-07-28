import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatMinuteRange, formatWonRange, type TicketSnapshot } from "@singsong/domain";
import { ARTWORK, resolvePalette, type Theme } from "@singsong/ticket-art";

import { MIN_TOUCH_TARGET } from "@/theme/tokens";
import { TICKET_ASPECT_RATIO } from "./ticket-front";

export function TicketBack({
  ticket,
  theme,
  width,
  onShowFront,
}: {
  ticket: TicketSnapshot;
  theme: Theme;
  width: number;
  onShowFront: () => void;
}) {
  const colors = resolvePalette(theme);
  const { calculation, items } = ticket.payload;
  const height = width / TICKET_ASPECT_RATIO;
  const scale = width / 540;
  const pricingLabel = calculation.pricing.kind === "song" ? "곡당 요금" : "시간 요금";

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          padding: Math.max(18, 32 * scale),
          borderRadius: ARTWORK.radiusPx * scale,
          backgroundColor: colors.paper,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel="티켓 뒷면 상세"
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: colors.accentText }]}>뒷면 · 상세</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            전체 곡 순서
          </Text>
        </View>
        <Pressable
          accessibilityRole="togglebutton"
          accessibilityLabel="티켓 뒷면 상세"
          accessibilityHint="끄면 티켓 앞면으로 돌아갑니다."
          accessibilityState={{ checked: true }}
          hitSlop={8}
          onPress={onShowFront}
          style={({ pressed }) => [
            styles.flipButton,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.flipButtonText, { color: colors.ink }]}>앞면</Text>
        </Pressable>
      </View>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={styles.list}
        contentContainerStyle={styles.listContent}
        accessibilityRole="list"
        accessibilityLabel={`전체 ${items.length}곡`}
      >
        {items.map((item) => (
          <View
            key={`${item.order}:${item.title}:${item.artist}`}
            style={[styles.songRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.index, { color: colors.accentText }]}>
              {String(item.order + 1).padStart(2, "0")}
            </Text>
            <View style={styles.songCopy}>
              <Text numberOfLines={1} style={[styles.songTitle, { color: colors.ink }]}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={[styles.artist, { color: colors.inkMuted }]}>
                {item.artist || "가수 미입력"}
              </Text>
            </View>
            <Text numberOfLines={2} style={[styles.code, { color: colors.inkMuted }]}>
              {item.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ") ||
                "직접 입력"}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.summary, { borderTopColor: colors.border }]}>
        <SummaryItem
          label="예상 시간"
          value={formatMinuteRange(calculation.duration.lowSec, calculation.duration.highSec)}
          color={colors.ink}
          muted={colors.inkMuted}
        />
        <SummaryItem
          label="총 비용"
          value={formatWonRange(calculation.derived.totalLowWon, calculation.derived.totalHighWon)}
          color={colors.money}
          muted={colors.inkMuted}
        />
        <SummaryItem
          label={`${calculation.people}명 · 1인당`}
          value={formatWonRange(
            calculation.derived.perPersonLowWon,
            calculation.derived.perPersonHighWon,
          )}
          color={colors.ink}
          muted={colors.inkMuted}
        />
        <Text style={[styles.assumption, { color: colors.inkMuted }]}>
          {pricingLabel} · 평균 곡 길이 기준 · 대기 시간 제외
        </Text>
      </View>
    </View>
  );
}

function SummaryItem({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.summaryRow} accessibilityRole="summary">
      <Text style={[styles.summaryLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  kicker: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 3,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  flipButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
  },
  flipButtonText: { fontSize: 13, fontWeight: "800" },
  list: { flex: 1, marginTop: 8 },
  listContent: { paddingBottom: 6 },
  songRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
  },
  index: {
    width: 25,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  songCopy: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  artist: { marginTop: 1, fontSize: 11, lineHeight: 15 },
  code: {
    width: 68,
    textAlign: "right",
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
  summary: {
    paddingTop: 10,
    marginTop: 7,
    borderTopWidth: 1,
    gap: 3,
  },
  summaryRow: {
    minHeight: 21,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { fontSize: 11, lineHeight: 16 },
  summaryValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  assumption: { marginTop: 3, fontSize: 9, lineHeight: 13 },
});
