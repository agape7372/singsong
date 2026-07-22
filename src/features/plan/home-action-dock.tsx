"use client";

import Link from "next/link";

export type HomeActionDockProps = {
  songCount: number;
  canIssue: boolean;
  disabled?: boolean;
  onOpenPricing: () => void;
  onIssue: () => void | Promise<void>;
};

export function HomeActionDock({
  songCount,
  canIssue,
  disabled = false,
  onOpenPricing,
  onIssue,
}: HomeActionDockProps) {
  if (songCount === 0) {
    return (
      <div className="home-action-dock">
        <div className="dock-copy">
          <strong>첫 곡을 담아 순서를 시작해요.</strong>
          <span>제목, 가수나 노래방 번호로 바로 찾을 수 있어요.</span>
        </div>
        <Link className="button" href="/search">
          노래 찾기
        </Link>
      </div>
    );
  }

  return (
    <div className="home-action-dock">
      <div className="dock-copy" aria-live="polite">
        <strong>
          {canIssue ? "이 순서를 티켓으로 발권할 수 있어요." : "요금과 인원을 먼저 입력해요."}
        </strong>
        <span>{canIssue ? `${songCount}곡 · 계산 완료` : `${songCount}곡 · 요금과 인원 필요`}</span>
      </div>
      <button
        className="button"
        type="button"
        disabled={disabled}
        onClick={() => (canIssue ? void onIssue() : onOpenPricing())}
      >
        {canIssue ? `${songCount}곡 티켓 만들기` : "요금과 인원 입력하기"}
      </button>
    </div>
  );
}
