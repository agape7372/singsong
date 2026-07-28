import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET } from "@/theme/tokens";

function loadTicketScreen(): {
  Component?: typeof import("./ticket-screen").TicketScreen;
  error?: string;
} {
  try {
    // Skia is a native module and is intentionally delayed for Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { Component: require("./ticket-screen").TicketScreen };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Expo Router evaluates route modules while building its tree. Keeping the
 * Skia feature behind this require preserves Expo Go/planner startup; the real
 * ticket path is available in the dev client and production native build.
 */
export function NativeTicketRoute({
  revisionParam,
}: {
  revisionParam: string | string[] | undefined;
}) {
  const router = useRouter();
  const loaded = useMemo(() => loadTicketScreen(), []);
  const { colors } = useAppTheme();

  if (loaded.Component) return <loaded.Component revisionParam={revisionParam} />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <View
        style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
          이 빌드에서는 Skia 티켓을 열 수 없어요.
        </Text>
        <Text style={[styles.body, { color: colors.inkMuted }]}>
          Expo Go가 아닌 싱송 dev client 또는 production 앱에서 다시 열어 주세요.
        </Text>
        {__DEV__ && loaded.error ? (
          <Text selectable style={[styles.error, { color: colors.accentText }]}>
            {loaded.error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/")}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.accentFill, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.actionText}>플랜으로</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 22,
    borderWidth: 1,
    borderRadius: 18,
  },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "900" },
  body: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  error: { marginTop: 12, fontSize: 11, lineHeight: 16 },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  actionText: { color: "#15131a", fontSize: 15, fontWeight: "900" },
});
