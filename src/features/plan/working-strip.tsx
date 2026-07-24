"use client";

import type { KeyboardEvent } from "react";
import type { Track } from "@/domain/models";
import { DOMAIN_LIMITS } from "@/domain/validation";
import { ProfileAvatar } from "@/features/profile/profile-avatar";
import { useProfile } from "@/features/profile/use-profile";

const VISIBLE_PARTICIPANTS = 5;

function ParticipantStack({
  people,
  disabled,
  onAddPerson,
}: {
  people: number | null;
  disabled: boolean;
  onAddPerson: () => void;
}) {
  const profile = useProfile();
  const participantCount = Math.min(Math.max(people ?? 1, 1), DOMAIN_LIMITS.maxPeople);
  const visibleCount = Math.min(participantCount, VISIBLE_PARTICIPANTS);
  const overflowCount = participantCount - visibleCount;
  const isAtMaximum = participantCount >= DOMAIN_LIMITS.maxPeople;
  const myName = profile.nickname.trim() || "나";

  return (
    <div className="station-participants">
      <ul className="station-avatar-list" aria-label={`참여자 ${participantCount}명`}>
        {Array.from({ length: visibleCount }, (_, index) =>
          index === 0 ? (
            <li className="station-avatar station-avatar-me" key={index}>
              <ProfileAvatar profile={profile} size={40} />
              <span className="sr-only">{myName}</span>
            </li>
          ) : (
            <li className="station-avatar" key={index}>
              <span aria-hidden="true">{index + 1}</span>
              <span className="sr-only">{`로컬 참여자 ${index + 1}`}</span>
            </li>
          ),
        )}
        {overflowCount > 0 && (
          <li className="station-avatar station-avatar-overflow">
            <span aria-hidden="true">+{overflowCount}</span>
            <span className="sr-only">그 외 로컬 참여자 {overflowCount}명</span>
          </li>
        )}
      </ul>
      <button
        className="station-add-person"
        type="button"
        onClick={onAddPerson}
        disabled={disabled || isAtMaximum}
        aria-label={
          isAtMaximum ? `참여자는 최대 ${DOMAIN_LIMITS.maxPeople}명입니다` : "참여자 한 명 추가"
        }
      >
        <span aria-hidden="true">＋</span>
      </button>
    </div>
  );
}

export function WorkingStrip({
  items,
  people,
  disabled,
  onAddPerson,
  onMove,
  onRemove,
  onOpenSearch,
  undoLabel,
  onUndo,
}: {
  items: readonly Track[];
  people: number | null;
  disabled: boolean;
  onAddPerson: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onOpenSearch: () => void;
  undoLabel: string | null;
  onUndo: () => void;
}) {
  function reorderWithKeyboard(event: KeyboardEvent<HTMLLIElement>, index: number) {
    if (disabled || !event.altKey) return;
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      onMove(index, -1);
    }
    if (event.key === "ArrowDown" && index < items.length - 1) {
      event.preventDefault();
      onMove(index, 1);
    }
  }

  return (
    <section className="working-strip" aria-labelledby="working-strip-title">
      {items.length === 0 ? (
        <>
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
            <output className="count-stamp" aria-label="최대 100곡 중 0곡">
              00 / 100
            </output>
          </div>
          <div className="empty-strip">
            <div>
              <h3>오늘 뭐 부를래?</h3>
              <p>노래 찾아서 담아봐, 여기 리스트가 채워질 거야</p>
              <button className="button empty-strip-action" type="button" onClick={onOpenSearch}>
                노래 찾으러 가기
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <ParticipantStack people={people} disabled={disabled} onAddPerson={onAddPerson} />
          <div className="station-ledger">
            <header className="station-ledger-heading">
              <span className="station-ledger-badge" aria-hidden="true">
                A
              </span>
              <h2 id="working-strip-title">SINGSONG</h2>
              <strong className="station-ledger-count" aria-label={`${items.length}곡`}>
                {items.length}
              </strong>
            </header>
            <p className="sr-only" id="working-strip-reorder-help">
              곡 행에서 Alt와 위쪽 또는 아래쪽 화살표 키를 함께 누르면 순서를 바꿀 수 있습니다. 순서
              변경 버튼도 키보드 포커스를 받으면 나타납니다.
            </p>
            <ol className="track-list">
              {items.map((item, index) => (
                <li
                  className="station-track-row"
                  key={item.id}
                  tabIndex={0}
                  aria-describedby="working-strip-reorder-help"
                  onKeyDown={(event) => reorderWithKeyboard(event, index)}
                >
                  <span className="track-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="track-copy">
                    <strong>{item.title}</strong>
                    <span>{item.artist}</span>
                  </div>
                  <div className="station-row-actions">
                    <div className="station-reorder-controls">
                      <button
                        type="button"
                        onClick={() => onMove(index, -1)}
                        disabled={disabled || index === 0}
                        aria-label={`${item.title} 한 칸 위로`}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(index, 1)}
                        disabled={disabled || index === items.length - 1}
                        aria-label={`${item.title} 한 칸 아래로`}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                    </div>
                    <button
                      className="station-track-remove"
                      type="button"
                      onClick={() => onRemove(index)}
                      disabled={disabled}
                      aria-label={`${item.title} 삭제`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="strip-add-row">
              <button
                className="button-link"
                type="button"
                onClick={onOpenSearch}
                aria-label="곡 하나 더 넣기"
              >
                <span className="strip-add-plus" aria-hidden="true">
                  +
                </span>
              </button>
            </div>
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
