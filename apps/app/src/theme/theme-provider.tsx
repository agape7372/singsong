import { AccessibilityInfo, Platform, useColorScheme, type ColorSchemeName } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { palette, type Palette, type Scheme } from "@/theme/tokens";

export type AppColors = {
  readonly [Key in keyof Palette]: string;
};

export type AppTheme = {
  readonly scheme: Scheme;
  readonly colors: AppColors;
  readonly isHighContrast: boolean;
};

const ThemeContext = createContext<AppTheme | null>(null);

function resolveScheme(value: ColorSchemeName): Scheme {
  return value === "dark" ? "dark" : "light";
}

/**
 * 네이티브 forced-colors 등가물은 없다. Android 고대비 텍스트와 iOS 굵은
 * 텍스트 설정을 감지해 경계 대비만 강화하고, 이를 웹 forced-colors 패리티라고
 * 부르지는 않는다.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = resolveScheme(useColorScheme());
  const [isHighContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const eventName = Platform.OS === "android" ? "highTextContrastChanged" : "boldTextChanged";
    const read =
      Platform.OS === "android"
        ? AccessibilityInfo.isHighTextContrastEnabled
        : AccessibilityInfo.isBoldTextEnabled;
    let mounted = true;

    void read().then((enabled) => {
      if (mounted) setHighContrast(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(eventName, setHighContrast);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo<AppTheme>(() => {
    const base = palette[scheme];
    if (!isHighContrast) return { scheme, colors: base, isHighContrast };
    return {
      scheme,
      isHighContrast,
      colors: {
        ...base,
        borderSubtle: base.ink,
        borderControl: base.ink,
        focus: base.ink,
      },
    };
  }, [isHighContrast, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside ThemeProvider");
  return value;
}
