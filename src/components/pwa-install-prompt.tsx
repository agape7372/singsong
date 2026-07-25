"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform?: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type InstallEnvironment = "checking" | "unsupported" | "ios-safari" | "standalone";

const dismissalKey = "singsong:pwa-install-dismissed-at";
const dismissalWindowMs = 14 * 24 * 60 * 60 * 1_000;

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    navigatorWithStandalone.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isIosSafari() {
  const userAgent = navigator.userAgent;
  const iOSDevice =
    /iPad|iPhone|iPod/u.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/u.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/u.test(userAgent);
  return iOSDevice && safari;
}

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number.parseInt(window.localStorage.getItem(dismissalKey) ?? "", 10);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < dismissalWindowMs;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(dismissalKey, String(Date.now()));
  } catch {
    // Storage can be unavailable in private browsing. The current render still dismisses.
  }
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const instructionsId = useId();
  const [environment, setEnvironment] = useState<InstallEnvironment>("checking");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligibleRoute =
    pathname === "/" ||
    pathname === "/library" ||
    pathname === "/discover" ||
    pathname === "/settings";
  const pwaEnabled = process.env.NEXT_PUBLIC_PWA_ENABLED !== "false";

  useEffect(() => {
    if (!pwaEnabled) return;

    const environmentTimer = window.setTimeout(() => {
      setDismissed(wasRecentlyDismissed());
      setEnvironment(isStandalone() ? "standalone" : isIosSafari() ? "ios-safari" : "unsupported");
    }, 0);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setError(null);
    };
    const handleInstalled = () => {
      rememberDismissal();
      setDismissed(true);
      setInstallPrompt(null);
      setEnvironment("standalone");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(environmentTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [pwaEnabled]);

  function dismiss() {
    rememberDismissal();
    setDismissed(true);
    setInstructionsOpen(false);
    setError(null);
  }

  async function requestInstall() {
    if (!installPrompt || isPrompting) return;
    setIsPrompting(true);
    setError(null);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      rememberDismissal();
      setInstallPrompt(null);
      setDismissed(true);
    } catch {
      setError("설치 창을 열지 못했어요. 브라우저 메뉴에서 앱 설치를 선택해 주세요.");
    } finally {
      setIsPrompting(false);
    }
  }

  if (
    !pwaEnabled ||
    !eligibleRoute ||
    dismissed ||
    environment === "checking" ||
    environment === "standalone" ||
    (environment !== "ios-safari" && !installPrompt)
  ) {
    return null;
  }

  const temporaryPreview = window.location.hostname.endsWith(".trycloudflare.com");
  const androidInstallAvailable = installPrompt !== null;

  return (
    <aside className="pwa-install-prompt" aria-label="앱 설치 안내">
      {/* 첫 화면을 가리는 배너다. 한 줄로 끝내고, 임시 주소 경고만 덧붙인다. */}
      <div className="pwa-install-copy">
        <strong>홈 화면에 추가하면 앱처럼 열려요.</strong>
        {temporaryPreview && <p>임시 주소라 연결이 꺼지면 안 열릴 수 있어요.</p>}
      </div>
      <div className="pwa-install-actions">
        {androidInstallAvailable ? (
          <button
            className="button button-small"
            type="button"
            disabled={isPrompting}
            onClick={() => void requestInstall()}
          >
            {isPrompting ? "설치 창 여는 중…" : "설치하기"}
          </button>
        ) : (
          <button
            className="button-secondary button-small"
            type="button"
            aria-expanded={instructionsOpen}
            aria-controls={instructionsId}
            onClick={() => setInstructionsOpen((open) => !open)}
          >
            설치 방법 보기
          </button>
        )}
        <button
          className="pwa-install-dismiss"
          type="button"
          aria-label="설치 배너 닫기"
          onClick={dismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {instructionsOpen && (
        <div className="pwa-install-instructions" id={instructionsId}>
          <ol>
            <li>Safari 아래쪽의 공유 버튼을 눌러 주세요.</li>
            <li>메뉴에서 ‘홈 화면에 추가’를 선택해 주세요.</li>
          </ol>
          <p>Safari에서 만든 플랜은 홈 화면 앱으로 자동 이동하지 않을 수 있어요.</p>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
