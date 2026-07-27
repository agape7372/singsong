import { Stack } from "expo-router";
import { ScrollView, StyleSheet, useColorScheme, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MotionSmoke } from "@/components/motion-smoke";
import { palette } from "@/theme/tokens";

/**
 * M2 선행 게이트 화면 — Reanimated·worklets 가 이 기기에서 도는지 판정한다.
 *
 * `/spike`(M0 하프톤)와 **분리한** 이유: M0 게이트 결과는 서명까지 끝난 증거물이라
 * (`docs/DEVICE_CHECKLIST_M0.md`) 그 화면에 섹션을 끼워 넣으면 B1~B15 의 스크롤 위치와
 * 판정 맥락이 같이 흔들린다. 이 화면은 M3 모션 랩으로 이어 쓴다.
 */
export default function MotionScreen() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = palette[scheme];
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "모션 스모크",
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
        }}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <MotionSmoke width={Math.min(width - 32, 380)} scheme={scheme} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48 },
});
