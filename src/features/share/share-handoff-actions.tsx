"use client";

import { useState } from "react";
import Link from "next/link";

export function ShareHandoffActions({ slug, inAppHint }: { slug: string; inAppHint: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const importHref = `/import?slug=${encodeURIComponent(slug)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("티켓 주소를 복사했습니다. 외부 브라우저 주소창에 붙여 넣어 주세요.");
    } catch {
      setStatus("주소를 복사하지 못했습니다. 브라우저 주소창의 현재 주소를 직접 복사해 주세요.");
    }
  }

  return (
    <div
      className="handoff-actions"
      role="group"
      aria-label="공유 티켓 가져오기"
      aria-describedby={inAppHint ? "handoff-guidance" : undefined}
    >
      <Link
        className="button"
        href={importHref}
        rel={inAppHint ? "nofollow noopener noreferrer" : "nofollow"}
        target={inAppHint ? "_blank" : undefined}
      >
        {inAppHint ? "외부 브라우저에서 저장" : "이 브라우저로 가져오기"}
      </Link>
      <button className="button-secondary" type="button" onClick={() => void copyLink()}>
        티켓 링크 복사
      </button>
      {inAppHint && (
        <p id="handoff-guidance" className="handoff-guidance">
          새 창도 인앱 브라우저로 열리면 링크를 복사해 Safari 또는 Chrome 주소창에 붙여 넣으세요.
          외부 브라우저에서 내용을 확인하고 저장해야 가져오기가 끝납니다.
        </p>
      )}
      <p className="handoff-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
