"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { unregisterSingSongPwa, waitForStablePlanRevision } from "@/pwa/update-safety";

export function PwaRegister() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const reloading = useRef(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    const updateConnectivity = () => setIsOffline(!navigator.onLine);
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      if (process.env.NEXT_PUBLIC_PWA_ENABLED === "false") {
        void unregisterSingSongPwa(navigator.serviceWorker, window.caches).catch(() => undefined);
        return () => {
          window.removeEventListener("online", updateConnectivity);
          window.removeEventListener("offline", updateConnectivity);
        };
      }

      let disposed = false;
      void navigator.serviceWorker
        .register("/sw.js")
        .then((nextRegistration) => {
          if (disposed) return;
          if (nextRegistration.waiting) setRegistration(nextRegistration);
          nextRegistration.addEventListener("updatefound", () => {
            const worker = nextRegistration.installing;
            worker?.addEventListener("statechange", () => {
              if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) {
                setRegistration(nextRegistration);
              }
            });
          });
        })
        // Registration is an enhancement. A blocked/unsupported worker must
        // never cover or disable the planner's primary actions.
        .catch(() => undefined);

      const handleControllerChange = () => {
        // A first install can claim this page without an update prompt. Only
        // reload after this tab explicitly approved a waiting worker.
        if (!updateRequested.current || reloading.current) return;
        reloading.current = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      return () => {
        disposed = true;
        window.removeEventListener("online", updateConnectivity);
        window.removeEventListener("offline", updateConnectivity);
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      };
    }

    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    const waiting = registration?.waiting;
    if (!waiting || isApplying) return;
    setIsApplying(true);
    setUpdateError(null);
    try {
      const { getActivePlan } = await import("@/data/plan-database");
      await waitForStablePlanRevision(
        getActivePlan,
        () =>
          new Promise((resolve) => {
            window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
          }),
      );
      updateRequested.current = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      updateRequested.current = false;
      setUpdateError("저장 상태를 확인하지 못해 업데이트를 멈췄습니다. 다시 시도해 주세요.");
      setIsApplying(false);
    }
  }, [isApplying, registration]);

  if (!registration && !isOffline && !updateError) return null;

  return (
    <aside className="status-toast" aria-live="polite" aria-atomic="true">
      {isOffline ? (
        <p>오프라인입니다. 이 기기의 세션 스트립은 계속 편집할 수 있어요.</p>
      ) : registration ? (
        <>
          <p>새 버전이 준비됐습니다. 저장된 세션을 유지한 채 업데이트할까요?</p>
          {updateError && <p role="alert">{updateError}</p>}
          <div className="button-row">
            <button
              className="button button-small"
              type="button"
              onClick={() => void applyUpdate()}
              disabled={isApplying}
            >
              {isApplying ? "저장 확인 중…" : "업데이트"}
            </button>
            <button
              className="button-link"
              type="button"
              onClick={() => setRegistration(null)}
              disabled={isApplying}
            >
              나중에
            </button>
          </div>
        </>
      ) : (
        <p role="alert">{updateError}</p>
      )}
    </aside>
  );
}
