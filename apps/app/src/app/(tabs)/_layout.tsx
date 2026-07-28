import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabGlyph, type TabGlyphName } from "@/components/tab-glyph";
import { tabBarMetrics } from "@/lib/tab-bar-metrics";
import { useAppTheme } from "@/theme/theme-provider";

/**
 * `NativeTabs`(expo-router/unstable-native-tabs) 가 SDK 57 템플릿 기본값이지만 쓰지 않는다.
 * 그쪽 아이콘 슬롯은 `require(png)`/SF Symbol 만 받아서 Skia path 아이콘(계획 M2)을 못 넣고,
 * fontScale 로 라벨을 끄는 제어도 못 한다.
 */
const TABS: { name: string; title: string; glyph: TabGlyphName }[] = [
  { name: "index", title: "플랜", glyph: "plan" },
  { name: "library", title: "보관함", glyph: "library" },
  { name: "discover", title: "발견", glyph: "discover" },
  { name: "settings", title: "설정", glyph: "settings" },
];

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = tabBarMetrics(fontScale, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarShowLabel: metrics.showLabel,
        tabBarLabelStyle: { fontSize: metrics.labelFontSize },
        tabBarStyle: {
          height: metrics.height,
          paddingBottom: metrics.paddingBottom,
          backgroundColor: colors.paper,
          borderTopColor: colors.borderSubtle,
        },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {TABS.map(({ name, title, glyph }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // 라벨을 끈 상태에서도 스크린리더는 한국어 이름을 읽어야 한다.
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color }) => (
              <TabGlyph name={glyph} size={metrics.iconSize} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
