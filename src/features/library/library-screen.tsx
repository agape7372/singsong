"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ManagedShareSummary } from "@/data/plan-database";
import type { TicketSnapshot } from "@/domain/models";
import { FlippableTicket } from "@/features/ticket/flippable-ticket";

const fixtureBuild = process.env.NEXT_PUBLIC_APP_PROFILE !== "production";

type Segment = "inProgress" | "completed";

type CollectionItem = {
  ticket: TicketSnapshot;
  share: ManagedShareSummary | null;
};

function formatDate(iso: string) {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString("ko-KR") : "";
}

/** Tracks which card sits closest to the carousel centre for the focus scale. */
function useCenteredCard(count: number) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count === 0) return;
    const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-collection-card]"));
    if (cards.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (Number.isInteger(index)) setActiveIndex(index);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [count]);

  return { trackRef, activeIndex };
}

function ShareStrip({
  share,
  busy,
  onCopy,
  onRevoke,
}: {
  share: ManagedShareSummary;
  busy: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="collection-share">
      <p className="collection-share-meta">
        <span className="collection-live-dot" aria-hidden="true" /> 공유 중 · 만료{" "}
        {share.expiresAt ? (
          <time dateTime={share.expiresAt}>{formatDate(share.expiresAt)}</time>
        ) : (
          "확인 불가"
        )}
      </p>
      <div className="collection-share-actions">
        <button className="button-secondary" type="button" onClick={onCopy} disabled={busy}>
          링크 복사
        </button>
        {share.canRevoke ? (
          <AlertDialog.Root>
            <AlertDialog.Trigger className="button-link collection-revoke" disabled={busy}>
              링크 폐기
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="dialog-backdrop" />
              <AlertDialog.Viewport className="dialog-viewport">
                <AlertDialog.Popup className="dialog-popup">
                  <AlertDialog.Title>이 공유 링크를 폐기할까요?</AlertDialog.Title>
                  <AlertDialog.Description>
                    주소를 받은 사람도 더 이상 열 수 없습니다. 이 세션은 완료 아카이브로 옮겨집니다.
                    되돌릴 수 없어요.
                  </AlertDialog.Description>
                  <div className="button-row">
                    <AlertDialog.Close className="button-secondary">취소</AlertDialog.Close>
                    <button
                      className="button-danger"
                      type="button"
                      onClick={onRevoke}
                      disabled={busy}
                    >
                      링크 폐기
                    </button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Viewport>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : (
          <span className="collection-share-note">이 브라우저엔 철회 키가 없어요.</span>
        )}
      </div>
    </div>
  );
}

function CollectionCard({
  item,
  index,
  active,
  busy,
  onCopy,
  onRevoke,
}: {
  item: CollectionItem;
  index: number;
  active: boolean;
  busy: boolean;
  onCopy: (slug: string) => void;
  onRevoke: (share: ManagedShareSummary) => void;
}) {
  const { ticket, share } = item;
  return (
    <li className="collection-card" data-collection-card data-index={index} data-active={active}>
      <FlippableTicket
        payload={ticket.payload}
        fingerprint={ticket.fingerprint}
        testData={fixtureBuild}
        headingLevel="h3"
        interactive={active}
      />
      {share ? (
        <ShareStrip
          share={share}
          busy={busy}
          onCopy={() => share.slug && onCopy(share.slug)}
          onRevoke={() => onRevoke(share)}
        />
      ) : (
        <div className="collection-archive">
          <p className="collection-archive-meta">
            <span className="collection-archive-stamp" aria-hidden="true">
              추억
            </span>
            <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time> 발권
          </p>
          {/* Full navigation keeps the ticket route's dedicated Turnstile CSP. */}
          <a className="button-secondary" href={`/ticket?r=${ticket.revision}`}>
            티켓 열기
          </a>
        </div>
      )}
    </li>
  );
}

function Carousel({
  items,
  busy,
  onCopy,
  onRevoke,
}: {
  items: CollectionItem[];
  busy: boolean;
  onCopy: (slug: string) => void;
  onRevoke: (share: ManagedShareSummary) => void;
}) {
  const { trackRef, activeIndex } = useCenteredCard(items.length);
  return (
    <div className="collection-carousel">
      <ul className="collection-track" ref={trackRef}>
        {items.map((item, index) => (
          <CollectionCard
            key={`${item.ticket.planId}-${item.ticket.revision}`}
            item={item}
            index={index}
            active={index === activeIndex}
            busy={busy}
            onCopy={onCopy}
            onRevoke={onRevoke}
          />
        ))}
      </ul>
      {items.length > 1 && (
        <p className="collection-progress" aria-hidden="true">
          {activeIndex + 1} / {items.length}
        </p>
      )}
    </div>
  );
}

export function LibraryScreen() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>("inProgress");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Defer the first setState off the synchronous effect path.
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const { listTickets, listManagedShares } = await import("@/data/plan-database");
        const [tickets, shares] = await Promise.all([listTickets(), listManagedShares()]);
        if (cancelled) return;
        const shareByFingerprint = new Map(shares.map((share) => [share.fingerprint, share]));
        setItems(
          tickets.map((ticket) => ({
            ticket,
            share: shareByFingerprint.get(ticket.fingerprint) ?? null,
          })),
        );
        setError(null);
      } catch {
        if (cancelled) return;
        setError("이 브라우저의 보관함을 읽지 못했습니다. 저장 공간 권한을 확인해 주세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      setStatus("링크를 복사했어요.");
    } catch {
      setStatus("복사 권한이 없어요. 티켓 화면에서 다시 시도해 주세요.");
    }
  }

  async function revokeShare(share: ManagedShareSummary) {
    if (busy || !share.slug) return;
    setBusy(true);
    setStatus(null);
    try {
      const { getManagedShare, deleteManagedShare } = await import("@/data/plan-database");
      const capability = await getManagedShare(share.fingerprint);
      if (!capability) {
        setStatus("이 브라우저에 철회 키가 없어 폐기할 수 없어요. 만료 시각까지 유지됩니다.");
        return;
      }
      const response = await fetch(`/api/shares/${share.slug}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${capability.revokeToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      if (!response.ok && response.status !== 404) {
        setStatus(
          response.status === 429
            ? "폐기 요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요."
            : "링크를 폐기하지 못했어요. 로컬 철회 키는 그대로 보관했어요.",
        );
        return;
      }
      await deleteManagedShare(share.fingerprint);
      setStatus("링크를 폐기하고 완료 아카이브로 옮겼어요.");
      setRefreshKey((key) => key + 1);
    } catch {
      setStatus("네트워크 오류로 폐기하지 못했어요. 연결 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const inProgress = items.filter((item) => item.share !== null);
  const completed = items.filter((item) => item.share === null);
  const shown = segment === "inProgress" ? inProgress : completed;

  return (
    <section className="page-shell task-shell library-shell" aria-labelledby="library-title">
      <header className="library-header">
        <p className="eyebrow">세션 콜렉션</p>
        <h1 id="library-title">보관함</h1>
      </header>

      <div className="collection-segments" role="radiogroup" aria-label="세션 분류">
        <button
          type="button"
          role="radio"
          aria-checked={segment === "inProgress"}
          className="collection-segment"
          data-selected={segment === "inProgress"}
          onClick={() => setSegment("inProgress")}
        >
          진행중 <span className="collection-segment-count">{inProgress.length}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={segment === "completed"}
          className="collection-segment"
          data-selected={segment === "completed"}
          onClick={() => setSegment("completed")}
        >
          완료 <span className="collection-segment-count">{completed.length}</span>
        </button>
      </div>

      {loading ? (
        <p className="collection-status" role="status">
          보관함을 여는 중…
        </p>
      ) : error ? (
        <p className="library-error" role="alert">
          {error}
        </p>
      ) : shown.length === 0 ? (
        <div className="collection-empty">
          {segment === "inProgress" ? (
            <>
              <p>지금 공유 중인 세션이 없어요.</p>
              <Link href="/">플랜에서 티켓 만들기</Link>
            </>
          ) : (
            <>
              <p>아직 완료된 세션이 없어요. 발권한 티켓이 여기에 쌓여요.</p>
              <Link href="/">플랜 열기</Link>
            </>
          )}
        </div>
      ) : (
        <Carousel items={shown} busy={busy} onCopy={copyLink} onRevoke={revokeShare} />
      )}

      <p className="collection-hint" aria-hidden="true">
        좌우로 넘겨 보세요
      </p>
      <p className="collection-live-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
