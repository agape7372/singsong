"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 소프트 키보드가 화면 아래에서 가린 높이(px)를 돌려준다.
 *
 * Android Chrome은 viewport meta의 `interactive-widget=resizes-content` 덕분에
 * layout viewport가 함께 줄어들어 대개 0을 돌려주지만, iOS Safari처럼 visual
 * viewport만 줄어드는 브라우저에서는 양수가 되어 시트를 키보드 위로 띄우는 데 쓰인다.
 */
export function useVisualViewportInset(active: boolean): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const viewport = typeof window === "undefined" ? null : window.visualViewport;
      if (!active || !viewport) return () => undefined;
      viewport.addEventListener("resize", onStoreChange);
      viewport.addEventListener("scroll", onStoreChange);
      return () => {
        viewport.removeEventListener("resize", onStoreChange);
        viewport.removeEventListener("scroll", onStoreChange);
      };
    },
    [active],
  );

  const getSnapshot = useCallback(() => {
    if (!active) return 0;
    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    if (!viewport) return 0;
    const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
    return hidden > 1 ? Math.round(hidden) : 0;
  }, [active]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
