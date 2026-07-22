"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation is the route-scoped Turnstile CSP security boundary. */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TicketSnapshot } from "@/domain/models";
import { useActivePlan } from "@/features/plan/use-active-plan";
import { TicketCard } from "./ticket-card";
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

const lightTicketExportStyle: Partial<CSSStyleDeclaration> & Record<`--${string}`, string> = {
  width: "540px",
  height: "675px",
  colorScheme: "light",
  opacity: "1",
  transform: "none",
  animation: "none",
  "--canvas": "#faf7f0",
  "--paper": "#ffffff",
  "--muted": "#f2ede3",
  "--ink": "#15131a",
  "--ink-muted": "#665f68",
  "--accent-fill": "#ff3d6e",
  "--accent-text": "#d91f52",
  "--on-accent": "#15131a",
  "--money": "#b76e00",
  "--money-text": "#8a5200",
  "--money-decoration": "#d99321",
  "--border-subtle": "#e2dbcf",
  "--border-control": "#817984",
  "--danger": "#c43a3a",
  "--focus": "#3b64d8",
  "--shadow": "0 10px 35px rgb(67 32 50 / 8%)",
  "--ticket-canvas": "#fdf6f9",
  "--ticket-paper": "#ffffff",
  "--ticket-surface-muted": "#fbeff3",
  "--ticket-ink": "#1c1622",
  "--ticket-ink-muted": "#6b5d6e",
  "--ticket-accent-fill": "#ff2e74",
  "--ticket-accent-text": "#d3155b",
  "--ticket-on-accent": "#1c1622",
  "--ticket-money-text": "#995f00",
  "--ticket-money-decoration": "#f5a623",
  "--ticket-border-subtle": "#f0dce4",
  "--ticket-border-control": "#9b7f8a",
  "--ticket-danger": "#c43a3a",
  "--ticket-focus-ring": "#1c1622",
};

export function TicketScreen() {
  const { plan, error: planError } = useActivePlan();
  const [ticket, setTicket] = useState<TicketSnapshot | null>(null);
  const [animate, setAnimate] = useState(false);
  const [receipt, setReceipt] = useState<ShareReceipt | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [managedSharesRevision, setManagedSharesRevision] = useState(0);
  const ticketRef = useRef<HTMLElement>(null);
  const renderedTracked = useRef<string | null>(null);
  const ticketLoadSequence = useRef(0);
  const turnstileRef = useRef<TurnstileChallengeHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const production = process.env.NEXT_PUBLIC_APP_PROFILE === "production";
  const busy = busyAction !== null;

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
        const snapshot = await getTicket(plan.id, plan.revision);
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
        setStatus("이 브라우저에서 티켓을 읽지 못했습니다. 저장 공간 권한을 확인해 주세요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

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
            <p className="eyebrow">발권 전</p>
            <h1 id="ticket-empty-title">현재 순서의 티켓이 아직 없어요.</h1>
          </header>
          <p className="lede state-strip-copy">
            곡·가격·인원을 확인하고 세션 티켓을 발급해 주세요.
          </p>
          <p
            className="ticket-status"
            role={status ? "alert" : "status"}
            aria-live={status ? "assertive" : "polite"}
          >
            {status}
          </p>
          <div className="state-strip-actions">
            <a className="button" href="/">
              세션으로 돌아가기
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
      const latestPlan = await getActivePlan();
      if (latestPlan.id !== ticket.planId || latestPlan.revision !== ticket.revision) {
        setShareConfirmed(false);
        setStatus(
          "곡 순서나 계산 설정이 바뀌어 이 티켓은 더 이상 최신 상태가 아닙니다. 최신 티켓을 다시 발급해 주세요.",
        );
        return;
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
        setStatus(
          "이전 발급 준비 정보가 다른 요청과 충돌해 안전하게 교체했습니다. 내용을 다시 확인한 뒤 재시도해 주세요.",
        );
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
      setStatus("30일 동안 주소를 받은 사람이 열 수 있는 검색 비노출 링크를 만들었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다.");
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
      setStatus("링크를 복사했습니다. 메신저에 직접 붙여 넣어 주세요.");
    } catch {
      setStatus(`복사 권한이 없습니다. 이 주소를 길게 눌러 복사하세요: ${shareUrl}`);
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
      setStatus("공유 화면을 닫았습니다. 실제 전송 여부는 선택한 앱에서 확인해 주세요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  async function downloadImage() {
    if (!ticketRef.current || !ticket) return;
    setBusyAction("png");
    setStatus(null);
    try {
      await document.fonts?.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 540,
        height: 675,
        backgroundColor: "#FFF",
        style: lightTicketExportStyle,
      });
      const link = document.createElement("a");
      link.download = `singsong-ticket-${ticket.fingerprint.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      trackAnalytics({ name: "image_save_succeeded" });
      setStatus("1080×1350 티켓 PNG를 저장했습니다.");
    } catch {
      setStatus("이미지를 만들지 못했습니다. 브라우저의 다운로드 권한을 확인해 주세요.");
    } finally {
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
        setStatus(
          "이 브라우저에 철회 키가 없어 링크를 폐기할 수 없습니다. 링크는 표시된 만료 시각까지 유지됩니다.",
        );
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
      setStatus(
        response.status === 404
          ? "이미 만료되었거나 폐기된 링크를 로컬 목록에서 정리했습니다."
          : "공유 링크를 폐기했습니다. 이미 저장된 메신저 미리보기는 바로 사라지지 않을 수 있어요.",
      );
    } catch {
      setStatus("링크를 폐기하지 못했습니다. 만료되기 전에 다시 시도해 주세요.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="page-shell ticket-screen" aria-labelledby="ticket-screen-heading">
      <header className="ticket-screen-heading">
        <div>
          <p className="eyebrow">04 · 발권 티켓</p>
          <h1 id="ticket-screen-heading">한 장으로 건넬 준비가 됐어요.</h1>
        </div>
        <a href="/">순서 다시 편집</a>
      </header>
      <div className="ticket-stage">
        <TicketCard
          ref={ticketRef}
          payload={ticket.payload}
          fingerprint={ticket.fingerprint}
          animate={animate}
          testData={process.env.NEXT_PUBLIC_APP_PROFILE === "fixture"}
          headingLevel="h2"
        />
      </div>
      {!receipt && (
        <fieldset className="share-receipt ticket-share-panel">
          <legend>공유 전 꼭 확인하세요</legend>
          <p className="ticket-disclosure-intro">
            공유 링크는 지금 보이는 티켓을 서버에 고정된 사본으로 저장합니다.
          </p>
          <ul id="share-disclosure">
            <li>
              검색 목록에는 나오지 않지만, 주소를 받은 사람은 로그인 없이 누구나 볼 수 있습니다.
            </li>
            <li>곡 제목·가수·노래방 번호와 곡 순서, 인원·예상 시간·비용이 포함됩니다.</li>
            <li>링크는 30일 후 만료되며, 발급된 티켓은 이후 플랜을 바꿔도 수정되지 않습니다.</li>
            <li>
              철회 키는 이 브라우저에만 저장됩니다. 브라우저 저장 공간을 지우면 만료 전에 직접
              철회할 수 없습니다.
            </li>
          </ul>
          <label>
            <input
              type="checkbox"
              checked={shareConfirmed}
              onChange={(event) => setShareConfirmed(event.currentTarget.checked)}
              aria-describedby="share-disclosure"
            />{" "}
            위 공개 범위, 포함 정보, 30일 만료, 고정 사본과 철회 키 보관 방식을 확인했습니다.
          </label>
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
              PNG 저장은 공유 링크를 만들거나 전송하지 않습니다.
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
              공유 시트가 닫혀도 실제 전송 여부는 선택한 앱에서 확인해 주세요.
            </p>
          </>
        )}
      </div>
      <p className="ticket-status" role="status" aria-live="polite">
        {status}
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
