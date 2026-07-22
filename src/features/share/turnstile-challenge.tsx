"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "auto";
      language: "ko";
      size: "flexible";
      action: "create_share";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileChallengeHandle = { reset(): void };

export const TurnstileChallenge = forwardRef<
  TurnstileChallengeHandle,
  { onToken: (token: string | null) => void }
>(function TurnstileChallenge({ onToken }, ref) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState("사람 확인을 준비하는 중…");

  onTokenRef.current = onToken;

  const clearToken = useCallback((message: string) => {
    onTokenRef.current(null);
    setStatus(message);
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      theme: "auto",
      language: "ko",
      size: "flexible",
      action: "create_share",
      callback: (token) => {
        onTokenRef.current(token);
        setStatus("사람 확인을 마쳤습니다.");
      },
      "expired-callback": () => clearToken("사람 확인이 만료됐습니다. 다시 확인해 주세요."),
      "timeout-callback": () => clearToken("사람 확인 시간이 지났습니다. 다시 시도해 주세요."),
      "error-callback": () =>
        clearToken("사람 확인을 불러오지 못했습니다. 네트워크를 확인해 주세요."),
    });
  }, [clearToken, siteKey]);

  useEffect(() => {
    if (scriptReady) renderWidget();
  }, [renderWidget, scriptReady]);

  useEffect(
    () => () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        clearToken("새 사람 확인을 기다리는 중…");
      },
    }),
    [clearToken],
  );

  if (!siteKey) {
    return <p className="field-error">공유 확인 설정이 없습니다. 운영자에게 알려 주세요.</p>;
  }

  return (
    <div className="turnstile-challenge">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div ref={container} />
      <p aria-live="polite">{status}</p>
    </div>
  );
});
