import type { ReactNode } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/theme/tokens";

/**
 * M0 자리표시. 실제 화면은 M2(플랜·설정)·M5(보관함·발견)에서 만든다.
 * 여기서 확인하려는 건 라우팅·안전영역·테마 추종·폰트 스케일뿐이다.
 */
export function PlaceholderScreen({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children?: ReactNode;
}) {
  const colors = palette[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.note, { color: colors.inkMuted }]}>{note}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  note: { fontSize: 15, lineHeight: 22 },
});
