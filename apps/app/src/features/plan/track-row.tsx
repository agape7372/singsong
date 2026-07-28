import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";

import type { Track } from "@singsong/domain";

import { AppText, Button, PerforationRule, QueueIndex } from "@/components/ui";
import { radius } from "@/theme/tokens";
import { useAppTheme } from "@/theme/theme-provider";

export function TrackRow({
  track,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  track: Track;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { colors } = useAppTheme();
  const codes = track.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ");

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === "decrement" && index > 0) onMove(-1);
    if (event.nativeEvent.actionName === "increment" && index < count - 1) onMove(1);
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}>
      <View
        accessible
        accessibilityActions={[
          { name: "decrement", label: "한 칸 위로 이동" },
          { name: "increment", label: "한 칸 아래로 이동" },
        ]}
        accessibilityLabel={`${index + 1}번째 곡, ${track.title}, ${track.artist || "가수 미입력"}`}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 1,
          max: count,
          now: index + 1,
          text: `${count}곡 중 ${index + 1}번째`,
        }}
        onAccessibilityAction={handleAccessibilityAction}
        style={styles.main}
      >
        <QueueIndex value={index + 1} />
        <View style={styles.copy}>
          <AppText variant="title">{track.title}</AppText>
          <AppText muted>{track.artist || "가수 미입력"}</AppText>
          <View style={styles.meta}>
            <AppText muted variant="caption">
              {track.source === "catalog" ? "목록 곡" : "직접 입력"}
            </AppText>
            {codes ? (
              <AppText muted variant="caption">
                {codes}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
      <PerforationRule />
      <View style={styles.actions}>
        <Button
          compact
          disabled={disabled || index === 0}
          kind="secondary"
          label="↑ 위"
          onPress={() => onMove(-1)}
          style={styles.action}
        />
        <Button
          compact
          disabled={disabled || index === count - 1}
          kind="secondary"
          label="↓ 아래"
          onPress={() => onMove(1)}
          style={styles.action}
        />
        <Button
          compact
          disabled={disabled}
          kind="danger"
          label="삭제"
          onPress={onRemove}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 14,
    gap: 12,
  },
  main: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  copy: { flex: 1, gap: 1 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  actions: { flexDirection: "row", gap: 7 },
  action: { flex: 1 },
});
