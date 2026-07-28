import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/theme-provider";

/**
 * M0 게이트 화면 — 하프톤·그레인·펀치를 실기기에서 눈으로 판정한다.
 *
 * Skia 는 네이티브 모듈이라 Expo Go 에서는 못 싣는다. expo-router 는 라우트 모듈을
 * 진입 시점에 `require` 하므로 이 화면을 열지 않는 한 Expo Go 도 정상 동작하지만,
 * 열었을 때 앱이 죽는 대신 이유를 보여주도록 캔버스 로딩을 지연 require 로 감쌌다.
 */
function loadSpikeCanvas(): {
  Component?: typeof import("@/components/spike-canvas").SpikeCanvas;
  error?: string;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { Component: require("@/components/spike-canvas").SpikeCanvas };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export default function SpikeScreen() {
  const { scheme, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { Component, error } = loadSpikeCanvas();

  const canvasWidth = Math.min(width - 32, 380);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "하프톤 스파이크",
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
        }}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {Component ? (
          <Component width={canvasWidth} scheme={scheme} />
        ) : (
          <View style={styles.fallback}>
            <Text style={[styles.head, { color: colors.ink }]}>Skia 를 못 불러왔다</Text>
            <Text style={[styles.text, { color: colors.inkMuted }]}>
              Expo Go 에는 네이티브 모듈이 없다. dev-client 빌드를 설치하고 다시 열어야 한다.
            </Text>
            <Text style={[styles.mono, { color: colors.inkMuted }]}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48 },
  fallback: { gap: 10 },
  head: { fontSize: 18, fontWeight: "700" },
  text: { fontSize: 14, lineHeight: 21 },
  mono: { fontSize: 11, lineHeight: 16, fontFamily: "monospace" },
});
