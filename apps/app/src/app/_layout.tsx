import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastHost, ToastProvider } from "@/lib/toast";
import { NativeStoreProvider } from "@/store/store-provider";
import { ThemeProvider, useAppTheme } from "@/theme/theme-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider preserveEdgeToEdge>
          <ThemeProvider>
            <NativeStoreProvider>
              <ToastProvider>
                <RootStack />
                <ToastHost />
              </ToastProvider>
            </NativeStoreProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors, scheme } = useAppTheme();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="search"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.72, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </>
  );
}
