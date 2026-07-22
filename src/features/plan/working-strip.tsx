"use client";

import Link from "next/link";
import type { Track } from "@/domain/models";

export function WorkingStrip({
  items,
  disabled,
  onMove,
  onRemove,
  undoLabel,
  onUndo,
}: {
  items: readonly Track[];
  disabled: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  undoLabel: string | null;
  onUndo: () => void;
}) {
  return (
    <section className="working-strip" aria-labelledby="working-strip-title">
      <div className="section-heading">
        <div>
          <p className="step-label">
            곡 담기{" "}
            <span className="serial-meta" aria-hidden="true">
              QUEUE / 01
            </span>
          </p>
          <h2 id="working-strip-title">오늘의 순서</h2>
        </div>
        <output className="count-stamp" aria-label={`최대 100곡 중 ${items.length}곡`}>
          {String(items.length).padStart(2, "0")} / 100
        </output>
      </div>
      {items.length === 0 ? (
        <div className="empty-strip">
          <div>
            <h3>오늘 뭐 부를래?</h3>
            <p>노래 찾아서 담아봐, 여기 리스트가 채워질 거야</p>
            <Link className="button empty-strip-action" href="/search">
              노래 찾으러 가기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ol className="track-list">
            {items.map((item, index) => (
              <li key={item.id}>
                <span className="track-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="track-copy">
                  <strong>{item.title}</strong>
                  <span>{item.artist}</span>
                  {item.karaokeCodes.length > 0 && (
                    <small>
                      {item.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ")}
                    </small>
                  )}
                </div>
                <div className="track-actions">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`${item.title} 한 칸 위로`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={disabled || index === items.length - 1}
                    aria-label={`${item.title} 한 칸 아래로`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={disabled}
                    aria-label={`${item.title} 삭제`}
                  >
                    빼기
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="strip-add-row">
            <Link className="button-link" href="/search">
              ＋ 곡 담기
            </Link>
            <span>{items.length}곡 담음</span>
          </div>
        </>
      )}
      {undoLabel && (
        <div className="undo-bar" role="status">
          <span>‘{undoLabel}’을 목록에서 뺐습니다.</span>
          <button className="button-link" type="button" onClick={onUndo}>
            되돌리기
          </button>
        </div>
      )}
    </section>
  );
}
