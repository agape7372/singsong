"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route_error", { digest: error.digest ?? "unavailable" });
  }, [error.digest]);

  return (
    <section
      className="page-shell narrow-shell state-strip state-strip-error"
      aria-labelledby="error-title"
      role="alert"
    >
      <header className="state-strip-header">
        <p className="eyebrow">다시 시도 필요</p>
        <h1 id="error-title">화면을 준비하지 못했어요.</h1>
      </header>
      <p className="lede state-strip-copy">
        이 기기에 저장된 세션은 지워지지 않았습니다. 같은 화면을 다시 불러와 주세요.
      </p>
      <div className="state-strip-actions">
        <button className="button" type="button" onClick={reset}>
          다시 불러오기
        </button>
      </div>
    </section>
  );
}
