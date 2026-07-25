"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation is the route-scoped Turnstile CSP security boundary. */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TicketSnapshot } from "@/domain/models";
import { useActivePlan } from "@/features/plan/use-active-plan";
import { FlippableTicket } from "./flippable-ticket";
import { TicketExportCard } from "./ticket-export-card";
import { TICKET_PALETTE } from "./ticket-art";
import { trackAnalytics } from "@/analytics/port";
import {
  TurnstileChallenge,
  type TurnstileChallengeHandle,
} from "@/features/share/turnstile-challenge";

const loadPlanDatabase = () => import("@/data/plan-database");
const ManagedSharesPanel = dynamic(
  () =>
    import("./managed-shares-panel").then(({ ManagedSharesPanel: LoadedManagedSharesPanel }) =>
      Promise.resolve(LoadedManagedSharesPanel),
    ),
  { ssr: false, loading: () => <p role="status">공유 목록을 준비하는 중…</p> },
);

type ShareReceipt = {
  slug: string;
  expiresAt: string;
  fingerprint: string;
};

type ShareResponse = ShareReceipt & {
  revokeToken: string;
  error?: { message?: string };
};

type BusyAction = "issue" | "png" | "revoke" | null;
type StatusMessage = { message: string; tone: "info" | "error" };

export function TicketScreen({ revision }: { revision?: number | undefined }) {
  const archived = revision !== undefined;
  const { plan, error: planError } = useActivePlan();
  const [ticket, setTicket] = useState<TicketSnapshot | null>(null);
  const [animate, setAnimate] = useState(false);
  const [receipt, setReceipt] = useState<ShareReceipt | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [managedSharesRevision, setManagedSharesRevision] = useState(0);
  const ticketRef = useRef<HTMLElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const renderedTracked = useRef<string | null>(null);
  const ticketLoadSequence = useRef(0);
  const turnstileRef = useRef<TurnstileChallengeHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const production = process.env.NEXT_PUBLIC_APP_PROFILE === "production";
  const busy = busyAction !== null;
  const notify = (message: string) => setStatus({ message, tone: "info" });
  const fail = (message: string) => setStatus({ message, tone: "error" });

  useEffect(() => {
    if (!plan) return;
    const sequence = ++ticketLoadSequence.current;
    let cancelled = false;
    turnstileRef.current?.reset();

    void (async () => {
      try {
        await Promise.resolve();
        if (cancelled || sequence !== ticketLoadSequence.current) return;
        setTicket(null);
        setAnimate(false);
        setReceipt(null);
        setShareConfirmed(false);
        setTurnstileToken(null);
        setStatus(null);
        const { getTicket, claimTicketMotion, getManagedShareReceipt } = await loadPlanDatabase();
        const snapshot = await getTicket(plan.id, revision ?? plan.revision);
        if (cancelled || sequence !== ticketLoadSequence.current) return;
        if (!snapshot) return;
        setTicket(snapshot);
        if (renderedTracked.current !== snapshot.fingerprint) {
          renderedTracked.current = snapshot.fingerprint;
          trackAnalytics({ name: "ticket_rendered" });
        }
        const claimed = await claimTicketMotion(snapshot.planId, snapshot.revision);
        if (cancelled || sequence !== ticketLoadSequence.current) return;
        setAnimate(claimed);
        const stored = await getManagedShareReceipt(snapshot.fingerprint);
        if (
          cancelled ||
          sequence !== ticketLoadSequence.current ||
          !stored?.slug ||
          !stored.expiresAt
        )
          return;
        setReceipt({
          slug: stored.slug,
          expiresAt: stored.expiresAt,
          fingerprint: stored.fingerprint,
        });
      } catch {
        if (cancelled || sequence !== ticketLoadSequence.current) return;
        fail("이 브라우저에서 티켓을 읽지 못했어요. 저장 공간 권한을 확인해 주세요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, revision]);

  if (!plan) {
    if (planError) {
      return (
        <section
          className="page-shell narrow-shell state-strip state-strip-error"
          aria-labelledby="ticket-storage-error-title"
        >
          <header className="state-strip-header">
            <p className="eyebrow">저장소 확인 필요</p>
            <h1 id="ticket-storage-error-title">이 브라우저의 티켓 저장소를 열 수 없어요.</h1>
          </header>
          <p className="state-strip-copy" role="alert">
            저장 공간 권한과 시크릿 모드 설정을 확인한 뒤 다시 시도해 주세요. 로컬 데이터는 서버로
            전송되지 않았습니다.
          </p>
          <div className="button-row">
            <button className="button" type="button" onClick={() => window.location.reload()}>
              페이지 다시 시도
            </button>
            <a className="button-secondary" href="/">
              세션으로 돌아가기
            </a>
          </div>
        </section>
      );
    }
    return (
      <section
        className="page-shell narrow-shell"
        aria-labelledby="ticket-loading-title"
        aria-busy="true"
      >
        <h1 id="ticket-loading-title" className="sr-only">
          세션 티켓
        </h1>
        <p role="status">티켓을 펼치는 중…</p>
      </section>
    );
  }

  if (!ticket) {
    return (
      <div className="page-shell narrow-shell">
        <section className="state-strip" aria-labelledby="ticket-empty-title">
          <header className="state-strip-header">
            <p className="eyebrow">{archived ? "보관된 티켓" : "발권 전"}</p>
            <h1 id="ticket-empty-title">
              {archived ? "이 티켓을 찾을 수 없어요." : "현재 순서의 티켓이 아직 없어요."}
            </h1>
          </header>
          <p className="lede state-strip-copy">
            {archived
              ? "보관된 티켓이 이 기기에서 지워졌거나 주소가 올바르지 않습니다."
              : "곡·가격·인원을 확인하고 세션 티켓을 발급해 주세요."}
          </p>
          <p
            className="ticket-status"
            data-tone={status?.tone}
            role={status?.tone === "error" ? "alert" : "status"}
            aria-live={status?.tone === "error" ? "assertive" : "polite"}
          >
            {status?.message}
          </p>
          <div className="state-strip-actions">
            <a className="button" href={archived ? "/library" : "/"}>
              {archived ? "보관함으로" : "세션으로 돌아가기"}
            </a>
          </div>
        </section>
        <ManagedSharesPanel
          refreshKey={managedSharesRevision}
          onRevoked={() => setManagedSharesRevision((revision) => revision + 1)}
        />
      </div>
    );
  }

  const shareUrl =
    receipt && typeof window !== "undefined" ? `${window.location.origin}/s/${receipt.slug}` : null;

  async function createShare() {
    if (busy || !ticket || !shareConfirmed) return;
    setBusyAction("issue");
    setStatus(null);
    try {
      const { getActivePlan, prepareManagedShare, rotateManagedShare, completeManagedShare } =
        await loadPlanDatabase();
      // Archived tickets are immutable snapshots opened deliberately from 보관함,
      // so the "plan changed since issue" guard only applies to the live ticket.
      if (!archived) {
        const latestPlan = await getActivePlan();
        if (latestPlan.id !== ticket.planId || latestPlan.revision !== ticket.revision) {
          setShareConfirmed(false);
          fail("곡 순서나 요금이 바뀌었어요. 티켓을 다시 만든 뒤 공유해 주세요.");
          return;
        }
      }
      const pending = await prepareManagedShare(ticket.fingerprint);
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: pending.idempotencyKey,
          revokeToken: pending.revokeToken,
          payload: ticket.payload,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as Partial<ShareResponse>;
      if (response.status === 409) {
        await rotateManagedShare(ticket.fingerprint);
        fail("동시에 요청이 겹쳐서 안전하게 취소했어요. 확인 후 다시 눌러 주세요.");
        setShareConfirmed(false);
        return;
      }
      if (!response.ok) throw new Error(body.error?.message ?? "공유 링크를 만들지 못했습니다.");
      if (
        !body.slug ||
        !body.revokeToken ||
        !body.expiresAt ||
        body.fingerprint !== ticket.fingerprint
      ) {
        throw new Error("공유 서버 응답을 확인하지 못했습니다. 링크를 다시 발급해 주세요.");
      }
      const next = {
        slug: body.slug,
        revokeToken: body.revokeToken,
        expiresAt: body.expiresAt,
        fingerprint: body.fingerprint,
      };
      await completeManagedShare(ticket.fingerprint, next);
      setReceipt({
        slug: next.slug,
        expiresAt: next.expiresAt,
        fingerprint: next.fingerprint,
      });
      setShareConfirmed(false);
      setManagedSharesRevision((revision) => revision + 1);
      notify("공유 링크를 만들었어요. 30일 동안 열 수 있어요.");
    } catch (error) {
      fail(error instanceof Error ? error.message : "공유 링크를 만들지 못했어요.");
    } finally {
      if (production) turnstileRef.current?.reset();
      setBusyAction(null);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackAnalytics({ name: "link_copy_succeeded" });
      notify("링크를 복사했어요. 메신저에 붙여 넣어 주세요.");
    } catch {
      fail(`복사 권한이 없어요. 이 주소를 길게 눌러 복사하세요: ${shareUrl}`);
    }
  }

  async function invokeShare() {
    if (!shareUrl || !navigator.share) return copyLink();
    try {
      trackAnalytics({ name: "share_invoked" });
      await navigator.share({
        title: "싱송 세션 티켓",
        text: "함께 부를 싱송 세션 티켓이에요.",
        url: shareUrl,
      });
      trackAnalytics({ name: "share_sheet_resolved" });
      notify("공유 화면을 닫았어요. 실제 전송은 선택한 앱에서 확인해 주세요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  async function downloadImage() {
    if (!exportRef.current || !ticket) return;
    setBusyAction("png");
    setStatus(null);
    let objectUrl: string | null = null;
    try {
      await document.fonts?.ready;
      const { toBlob } = await import("html-to-image");
      // 고정 지오메트리 전용 카드를 그대로 캡처한다. width/height/style 옵션을 주면
      // 클론 루트만 늘어나고 자식은 캡처 시점 px에 갇혀 캔버스 한쪽만 채운다.
      const blob = await toBlob(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        // 라운드 모서리 밖은 앱 배경색으로 채운다(투명이 검정으로 보이는 것 방지).
        backgroundColor: TICKET_PALETTE.hole,
      });
      if (!blob) throw new Error("이미지를 만들지 못했어요.");
      // data: URL은 안드로이드 크롬에서 대용량일 때 다운로드가 조용히 실패한다.
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `singsong-ticket-${ticket.fingerprint.slice(0, 8)}.png`;
      link.href = objectUrl;
      link.click();
      trackAnalytics({ name: "image_save_succeeded" });
      notify("티켓 이미지를 저장했어요.");
    } catch {
      fail("이미지를 만들지 못했어요. 브라우저의 다운로드 권한을 확인해 주세요.");
    } finally {
      const created = objectUrl;
      if (created) setTimeout(() => URL.revokeObjectURL(created), 60_000);
      setBusyAction(null);
    }
  }

  async function revoke() {
    if (!receipt || !ticket || busy) return;
    setBusyAction("revoke");
    try {
      const { getManagedShare, deleteManagedShare } = await loadPlanDatabase();
      const capability = await getManagedShare(ticket.fingerprint);
      if (!capability) {
        fail("이 브라우저에 철회 키가 없어 폐기할 수 없어요. 링크는 만료 시각까지 유지돼요.");
        return;
      }
      const response = await fetch(`/api/shares/${receipt.slug}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${capability.revokeToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      if (!response.ok && response.status !== 404) throw new Error();
      await deleteManagedShare(ticket.fingerprint);
      setReceipt(null);
      setShareConfirmed(false);
      setManagedSharesRevision((revision) => revision + 1);
      notify(
        response.status === 404
          ? "이미 만료됐거나 폐기된 링크를 목록에서 정리했어요."
          : "공유 링크를 폐기했어요. 메신저에 남은 미리보기는 바로 사라지지 않을 수 있어요.",
      );
    } catch {
      fail("링크를 폐기하지 못했어요. 만료 전에 다시 시도해 주세요.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="page-shell ticket-screen" aria-labelledby="ticket-screen-heading">
      <header className="ticket-screen-heading">
        <div>
          <p className="eyebrow">{archived ? "보관된 티켓" : "세션 티켓"}</p>
          <h1 id="ticket-screen-heading">
            {archived ? "보관함에서 다시 열었어요." : "한 장으로 건넬 준비가 됐어요."}
          </h1>
        </div>
        <a href={archived ? "/library" : "/"}>{archived ? "보관함으로" : "순서 다시 편집"}</a>
      </header>
      <div className="ticket-stage">
        <FlippableTicket
          frontRef={ticketRef}
          payload={ticket.payload}
          fingerprint={ticket.fingerprint}
          animate={animate}
          testData={process.env.NEXT_PUBLIC_APP_PROFILE === "fixture"}
          headingLevel="h2"
        />
      </div>
      {/* PNG 캡처 전용. 화면 밖에 고정 크기로 그려 둔다(디스플레이 폭에 영향받지 않게). */}
      <div
        data-ticket-export-host="true"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          width: "540px",
          pointerEvents: "none",
        }}
      >
        <TicketExportCard
          ref={exportRef}
          payload={ticket.payload}
          fingerprint={ticket.fingerprint}
          testData={process.env.NEXT_PUBLIC_APP_PROFILE === "fixture"}
        />
      </div>
      {!receipt && (
        <fieldset className="share-receipt ticket-share-panel">
          <legend>공유 전 꼭 확인하세요</legend>
          <p className="ticket-disclosure-intro" id="share-disclosure-summary">
            주소를 아는 사람은 누구나 볼 수 있고, 30일 뒤 만료돼요.
          </p>
          <details className="share-disclosure-details">
            <summary>무엇이 공유되나요?</summary>
            <ul id="share-disclosure">
              <li>지금 보이는 티켓이 서버에 사본으로 저장돼요. 검색 목록에는 나오지 않아요.</li>
              <li>곡 제목·가수·노래방 번호와 순서, 인원·예상 시간·비용이 담겨요.</li>
              <li>발급한 티켓은 이후 플랜을 바꿔도 그대로예요.</li>
              <li>
                철회 키는 이 브라우저에만 있어요. 저장 공간을 지우면 만료 전에 직접 철회할 수
                없어요.
              </li>
            </ul>
          </details>
          <label>
            <input
              type="checkbox"
              checked={shareConfirmed}
              onChange={(event) => setShareConfirmed(event.currentTarget.checked)}
              aria-describedby="share-disclosure-summary"
            />{" "}
            공개 범위와 30일 만료, 철회 키 보관 방식을 확인했어요.
          </label>
          {!production && (
            <p className="ticket-demo-note">
              <span className="test-data-badge" aria-hidden="true">
                DEMO
              </span>
              가상 곡 목록으로 만든 데모 링크예요.
            </p>
          )}
        </fieldset>
      )}
      {production && !receipt && (
        <TurnstileChallenge ref={turnstileRef} onToken={setTurnstileToken} />
      )}
      {receipt && (
        <section className="share-receipt ticket-share-result" aria-labelledby="share-result-title">
          <div>
            <p className="eyebrow">공유 링크 준비됨</p>
            <h2 id="share-result-title">30일 동안 열 수 있어요.</h2>
          </div>
          <p>
            만료:{" "}
            <time dateTime={receipt.expiresAt}>
              {new Date(receipt.expiresAt).toLocaleString("ko-KR")}
            </time>
          </p>
          <a href={shareUrl ?? undefined} rel="nofollow noreferrer">
            발급된 티켓 열기
          </a>
        </section>
      )}
      <div
        className="ticket-actions"
        role="group"
        aria-label="티켓 공유 작업"
        aria-describedby="ticket-action-note"
      >
        {!receipt ? (
          <>
            <button
              className="button"
              type="button"
              onClick={() => void createShare()}
              disabled={busy || !shareConfirmed || (production && !turnstileToken)}
              aria-busy={busyAction === "issue"}
              aria-invalid={status?.tone === "error" || undefined}
              aria-errormessage={status?.tone === "error" ? "ticket-status" : undefined}
            >
              {busyAction === "issue" ? "공유 링크 발급 중…" : "공유 링크 발급"}
            </button>
            <button
              className="button-secondary ticket-tertiary-action"
              type="button"
              onClick={() => void downloadImage()}
              disabled={busy}
              aria-busy={busyAction === "png"}
            >
              {busyAction === "png" ? "PNG 만드는 중…" : "PNG 저장"}
            </button>
            <p id="ticket-action-note" className="ticket-action-note">
              PNG 저장은 링크를 만들지 않아요.
            </p>
          </>
        ) : (
          <>
            <button
              className="button"
              type="button"
              onClick={() => void invokeShare()}
              disabled={busy}
            >
              링크 공유
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => void copyLink()}
              disabled={busy}
            >
              링크 복사
            </button>
            <button
              className="button-secondary ticket-tertiary-action"
              type="button"
              onClick={() => void downloadImage()}
              disabled={busy}
              aria-busy={busyAction === "png"}
            >
              {busyAction === "png" ? "PNG 만드는 중…" : "PNG 저장"}
            </button>
            <button
              className="button-danger"
              type="button"
              onClick={() => void revoke()}
              disabled={busy}
              aria-busy={busyAction === "revoke"}
            >
              {busyAction === "revoke" ? "링크 폐기 중…" : "링크 폐기"}
            </button>
            <p id="ticket-action-note" className="ticket-action-note">
              실제 전송은 선택한 앱에서 확인해 주세요.
            </p>
          </>
        )}
      </div>
      <p
        id="ticket-status"
        className="ticket-status"
        data-tone={status?.tone}
        role={status?.tone === "error" ? "alert" : "status"}
        aria-live={status?.tone === "error" ? "assertive" : "polite"}
      >
        {status?.message}
      </p>
      <ManagedSharesPanel
        refreshKey={managedSharesRevision}
        onRevoked={(fingerprint) => {
          if (receipt?.fingerprint === fingerprint) {
            setReceipt(null);
            setShareConfirmed(false);
          }
          setManagedSharesRevision((revision) => revision + 1);
        }}
      />
    </section>
  );
}
