"use client";

export type HomeActionDockProps = {
  songCount: number;
  canIssue: boolean;
  disabled?: boolean;
  onOpenPricing: () => void;
  onIssue: () => void | Promise<void>;
  onOpenSearch: () => void;
};

export function HomeActionDock({
  songCount,
  canIssue,
  disabled = false,
  onOpenPricing,
  onIssue,
  onOpenSearch,
}: HomeActionDockProps) {
  if (songCount === 0) {
    return (
      <div className="home-action-dock">
        <div className="dock-copy">
          <strong>첫 곡을 담아 순서를 시작해요.</strong>
          <span>제목, 가수나 노래방 번호로 바로 찾을 수 있어요.</span>
        </div>
        <button className="button" type="button" onClick={onOpenSearch}>
          노래 찾기
        </button>
      </div>
    );
  }

  return (
    <div className="home-action-dock">
      <button
        className="button home-confirm-action"
        type="button"
        disabled={disabled}
        onClick={() => (canIssue ? void onIssue() : onOpenPricing())}
      >
        <span className="home-confirm-label">완료</span>
      </button>
    </div>
  );
}
