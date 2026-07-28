import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSegments } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";
import { useAppTheme } from "@/theme/theme-provider";

type ToastOptions = {
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly durationMs?: number;
};

type ToastRecord = ToastOptions & {
  readonly id: number;
  readonly message: string;
};

type ToastApi = {
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const ToastStateContext = createContext<ToastRecord | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRecord | null>(null);
  const nextId = useRef(1);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    setToast({ id: nextId.current++, message, ...options });
  }, []);
  const api = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={api}>
      <ToastStateContext.Provider value={toast}>{children}</ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

/**
 * 탭 밖의 `/ticket`·`/import`에서도 렌더되므로 useBottomTabBarHeight를 쓰지
 * 않는다. 하단 안전영역과 60dp 탭 콘텐츠 높이를 직접 더한다.
 */
export function ToastHost() {
  const toast = useContext(ToastStateContext);
  const { dismissToast } = useToast();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const tabOffset = segments[0] === "(tabs)" ? 68 : 12;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, toast.durationMs ?? 4_500);
    return () => clearTimeout(timer);
  }, [dismissToast, toast]);

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + tabOffset }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            backgroundColor: colors.ink,
            borderColor: colors.borderControl,
          },
        ]}
      >
        <Text style={[styles.message, { color: colors.paper }]}>{toast.message}</Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              dismissToast();
              toast.onAction?.();
            }}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, { color: colors.accentFill }]}>
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.action,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  message: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  action: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  actionLabel: { fontSize: 14, fontWeight: "800" },
});
