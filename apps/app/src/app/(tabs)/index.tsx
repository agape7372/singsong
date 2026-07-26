import { Link } from "expo-router";
import { useEffect } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlaceholderScreen } from "@/components/placeholder-screen";
import { tabBarMetrics } from "@/lib/tab-bar-metrics";
import { palette, radius } from "@/theme/tokens";

/**
 * M0 확인 화면. 빈 탭만 띄우면 "떴다" 말고는 아무것도 배우지 못하므로,
 * M2 레이아웃 결정에 실제로 쓰이는 값(폰트 스케일·안전영역·탭바 산출 높이)을 같이 읽는다.
 */
export default function PlanScreen() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = palette[scheme];
  const { width, height, fontScale, scale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = tabBarMetrics(fontScale, insets.bottom);

  // 같은 값을 Metro 로그로도 흘린다. 화면을 사진 찍어 옮겨 적는 왕복이 없어지고,
  // 무엇보다 옮겨 적다 틀릴 일이 없다. M2 레이아웃이 이 숫자 위에 올라간다.
  useEffect(() => {
    console.log(
      "[METRICS]",
      JSON.stringify({
        platform: `${Platform.OS} ${String(Platform.Version)}`,
        window: { width, height },
        pixelRatio: scale,
        fontScale,
        insets,
        tabBar: metrics,
        scheme,
      }),
    );
  }, [width, height, scale, fontScale, insets, metrics, scheme]);

  const rows: [string, string][] = [
    ["플랫폼", `${Platform.OS} ${String(Platform.Version)}`],
    ["창 크기", `${Math.round(width)} × ${Math.round(height)} dp @${scale}x`],
    ["폰트 스케일", `${fontScale.toFixed(2)} → 라벨 ${metrics.showLabel ? "켬" : "끔"}`],
    [
      "안전영역",
      `상 ${Math.round(insets.top)} / 하 ${Math.round(insets.bottom)} / 좌 ${Math.round(insets.left)} / 우 ${Math.round(insets.right)}`,
    ],
    ["탭바 높이", `${metrics.height} dp (아이콘 ${metrics.iconSize})`],
    ["테마", scheme],
  ];

  return (
    <PlaceholderScreen title="플랜" note="곡 담기·계산·발권. M2 에서 만든다.">
      <View
        style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
      >
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.label, { color: colors.inkMuted }]}>{label}</Text>
            <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
          </View>
        ))}
      </View>

      <Link href="/spike" style={[styles.link, { color: colors.accentText }]}>
        하프톤 스파이크 열기 (dev-client 전용)
      </Link>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radius.strip,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  link: { marginTop: 16, fontSize: 15, fontWeight: "600" },
});
