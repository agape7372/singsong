import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { palette } from "@/theme/tokens";

/**
 * M0 루트. KeyboardProvider·ThemeProvider·useFonts·ToastHost 는 M2 에서 붙인다.
 */
export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = palette[scheme];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
