"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createTicketSnapshot } from "@/domain/canonical";
import { DOMAIN_LIMITS, normalizeTrackText } from "@/domain/validation";
import type { Plan, PricingConfig, Track } from "@/domain/models";
import type { CatalogTrack } from "@/features/catalog/types";
import { AppHeaderActions } from "@/components/app-header-actions";
import { BottomSlot } from "@/components/bottom-slot";
import { CalculationStrip, type CalculationStripHandle } from "./calculation-strip";
import { HomeActionDock } from "./home-action-dock";
import { PlanRail } from "./plan-rail";
import { SearchLedger, type ManualTrackInput } from "./search-ledger";
import { useActivePlan } from "./use-active-plan";
import { WorkingStrip } from "./working-strip";
import { trackAnalytics } from "@/analytics/port";

type RemovedTrack = { track: Track; index: number };
type ResetBackup = Pick<Plan, "items" | "people" | "pricing">;

const NewPlanDialog = dynamic(
  () => import("./new-plan-dialog").then((module) => module.NewPlanDialog),
  { ssr: false, loading: () => <p role="status">확인 창을 준비하는 중…</p> },
);

function WorkspaceLoading({ view }: { view: "plan" | "search" }) {
  return (
    <section
      className={`page-shell task-shell task-shell-${view} workspace-loading`}
      aria-busy="true"
      aria-labelledby="workspace-loading-title"
    >
      {view === "search" ? (
        <>
          <header className="workspace-header">
            <div>
              <p className="step-label">
                곡 담기{" "}
                <span className="serial-meta" aria-hidden="true">
                  LEDGER / 02
                </span>
              </p>
              <h1 id="workspace-loading-title">곡 찾기</h1>
              <p className="workspace-status-line" role="status">
                저장된 플랜을 확인하는 중…
              </p>
            </div>
          </header>
          <div className="search-ledger search-ledger-loading" aria-hidden="true">
            <div className="loading-search-field" />
            <ul className="result-list search-loading-list">
              {[1, 2, 3].map((index) => (
                <li className="search-result-row" key={index}>
                  <span className="search-result-index">--</span>
                  <span className="loading-ledger-copy">
                    <span className="loading-line" />
                    <span className="loading-line loading-line-short" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          <h1 className="sr-only" id="workspace-loading-title">
            오늘의 플랜
          </h1>
          <div className="working-session-strip loading-session-strip">
            <section
              className="working-strip working-strip-loading"
              aria-labelledby="loading-strip-title"
            >
              <div className="section-heading">
                <div>
                  <p className="step-label">
                    곡 순서{" "}
                    <span className="serial-meta" aria-hidden="true">
                      QUEUE / 01
                    </span>
                  </p>
                  <h2 id="loading-strip-title">오늘의 순서를 여는 중</h2>
                </div>
                <span className="count-stamp" aria-hidden="true">
                  -- / 100
                </span>
              </div>
              <ol className="track-list loading-track-list" aria-hidden="true">
                {[1, 2, 3].map((index) => (
                  <li key={index}>
                    <span className="track-number">{String(index).padStart(2, "0")}</span>
                    <span className="loading-ledger-copy">
                      <span className="loading-line" />
                      <span className="loading-line loading-line-short" />
                    </span>
                  </li>
                ))}
              </ol>
              <p className="loading-status" role="status">
                이 기기에 저장된 순서를 불러오고 있어요.
              </p>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export function PlanWorkspace({ view }: { view: "plan" | "search" }) {
  const { plan, error, notice, isSaving, mutate, dismissError, announce } = useActivePlan();
  const [removed, setRemoved] = useState<RemovedTrack | null>(null);
  const [resetBackup, setResetBackup] = useState<ResetBackup | null>(null);
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const issuing = useRef(false);
  const calculationRef = useRef<CalculationStripHandle>(null);
  const overflowRef = useRef<HTMLDetailsElement>(null);

  if (!plan && error) {
    return (
      <section
        className={`page-shell task-shell task-shell-${view} workspace-recovery`}
        role="alert"
        aria-labelledby="workspace-storage-error-title"
      >
        <div className="working-session-strip recovery-session-strip">
          <div className="working-strip">
            <p className="step-label">
              저장소 확인{" "}
              <span className="serial-meta" aria-hidden="true">
                LOCAL / BLOCKED
              </span>
            </p>
            <h1 id="workspace-storage-error-title">이 기기의 플랜을 열지 못했어요.</h1>
            <p className="section-copy">{error}</p>
            <button className="button" type="button" onClick={() => window.location.reload()}>
              저장소 다시 확인
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!plan) {
    return <WorkspaceLoading view={view} />;
  }

  async function addCatalogTrack(catalog: CatalogTrack) {
    if (plan!.items.length >= 100) return false;
    if (plan!.items.some((item) => item.catalogSongId === catalog.id)) {
      announce(`‘${catalog.title}’은 이미 플랜에 담겨 있습니다.`);
      return false;
    }
    const karaokeCodes = Object.entries(catalog.karaokeCodes)
      .filter(
        (entry): entry is ["TJ" | "KY", string] =>
          (entry[0] === "TJ" || entry[0] === "KY") && Boolean(entry[1]),
      )
      .map(([vendor, code]) => ({ vendor, code }));
    const added = await mutate(
      (current) => ({
        items: [
          ...current.items,
          {
            id: crypto.randomUUID(),
            source: "catalog",
            catalogSongId: catalog.id,
            title: normalizeTrackText(catalog.title),
            artist: normalizeTrackText(catalog.artist),
            karaokeCodes,
            order: current.items.length,
          },
        ],
        people: current.people,
        pricing: current.pricing,
      }),
      `‘${catalog.title}’을 ${plan!.items.length + 1}번째 곡으로 담았습니다.`,
    );
    if (added) {
      trackAnalytics({ name: "song_added", source: "catalog" });
      setResetBackup(null);
    }
    setRemoved(null);
    return added;
  }

  async function addManualTrack(input: ManualTrackInput) {
    if (plan!.items.length >= 100) return false;
    const added = await mutate(
      (current) => ({
        items: [
          ...current.items,
          {
            id: crypto.randomUUID(),
            source: "manual",
            catalogSongId: null,
            title: normalizeTrackText(input.title),
            artist: normalizeTrackText(input.artist),
            karaokeCodes: input.karaokeCode
              ? [{ vendor: input.karaokeVendor, code: input.karaokeCode }]
              : [],
            order: current.items.length,
          },
        ],
        people: current.people,
        pricing: current.pricing,
      }),
      `‘${input.title}’을 직접 입력해 담았습니다.`,
    );
    if (added) {
      trackAnalytics({ name: "song_added", source: "manual" });
      setResetBackup(null);
    }
    return added;
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= plan!.items.length) return;
    const success = await mutate((current) => {
      const items = [...current.items];
      const first = items[index];
      const second = items[target];
      if (!first || !second) return { items, people: current.people, pricing: current.pricing };
      items[index] = second;
      items[target] = first;
      return { items, people: current.people, pricing: current.pricing };
    });
    if (success) setResetBackup(null);
    setRemoved(null);
  }

  async function remove(index: number) {
    const track = plan!.items[index];
    if (!track) return;
    const success = await mutate((current) => ({
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
      people: current.people,
      pricing: current.pricing,
    }));
    if (success) {
      setRemoved({ track, index });
      setResetBackup(null);
    }
  }

  async function undo() {
    if (!removed) return;
    const success = await mutate((current) => {
      const items = [...current.items];
      items.splice(Math.min(removed.index, items.length), 0, removed.track);
      return { items, people: current.people, pricing: current.pricing };
    });
    if (success) setRemoved(null);
  }

  async function undoCatalogAdd(catalogSongId: string) {
    const success = await mutate(
      (current) => ({
        items: current.items.filter((item) => item.catalogSongId !== catalogSongId),
        people: current.people,
        pricing: current.pricing,
      }),
      "방금 담은 곡을 플랜에서 되돌렸습니다.",
    );
    if (success) setResetBackup(null);
    return success;
  }

  function isManualDuplicate(input: ManualTrackInput) {
    const title = normalizeTrackText(input.title);
    const artist = normalizeTrackText(input.artist);
    return plan!.items.some(
      (item) =>
        normalizeTrackText(item.title) === title && normalizeTrackText(item.artist) === artist,
    );
  }

  async function applyCalculation(people: number, pricing: PricingConfig) {
    const success = await mutate(
      (current) => ({ items: current.items, people, pricing }),
      "가격과 인원을 계산에 적용했습니다.",
    );
    if (success) setResetBackup(null);
    return success;
  }

  async function addParticipant() {
    const currentPeople = plan!.people ?? 1;
    if (currentPeople >= DOMAIN_LIMITS.maxPeople) {
      announce(`참여자는 최대 ${DOMAIN_LIMITS.maxPeople}명까지 추가할 수 있습니다.`);
      return;
    }
    const nextPeople = currentPeople + 1;
    const success = await mutate(
      (current) => ({
        items: current.items,
        people: Math.min((current.people ?? 1) + 1, DOMAIN_LIMITS.maxPeople),
        pricing: current.pricing,
      }),
      `참여자를 ${nextPeople}명으로 늘렸습니다.`,
    );
    if (success) setResetBackup(null);
  }

  async function startNewPlan() {
    if (plan!.items.length === 0) return;
    const backup: ResetBackup = {
      items: structuredClone(plan!.items),
      people: plan!.people,
      pricing: structuredClone(plan!.pricing),
    };
    const success = await mutate(
      () => ({ items: [], people: null, pricing: null }),
      "새 플랜을 시작했습니다. 필요하면 바로 이전 플랜으로 되돌릴 수 있습니다.",
    );
    if (success) {
      setResetBackup(backup);
      setRemoved(null);
      setNewPlanDialogOpen(false);
    }
  }

  async function undoNewPlan() {
    if (!resetBackup) return;
    const backup = structuredClone(resetBackup);
    const success = await mutate(
      () => backup,
      `이전 ${backup.items.length}곡 플랜을 되돌렸습니다.`,
    );
    if (success) setResetBackup(null);
  }

  async function issueTicket() {
    if (issuing.current || !plan!.people || !plan!.pricing || plan!.items.length === 0) return;
    issuing.current = true;
    try {
      const ticket = await createTicketSnapshot(plan!);
      const { saveTicket } = await import("@/data/plan-database");
      await saveTicket(ticket);
      announce("이 revision의 티켓을 발급했습니다.");
      // `/ticket` has a deliberately broader production CSP for Turnstile.
      // A full navigation is required because a client transition retains the
      // CSP of the document that originally loaded `/`.
      window.location.assign("/ticket");
    } catch {
      announce("티켓을 발급하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.");
    } finally {
      issuing.current = false;
    }
  }

  const canIssue =
    plan.items.length > 0 &&
    plan.people !== null &&
    Number.isSafeInteger(plan.people) &&
    plan.people >= 1 &&
    plan.people <= 30 &&
    plan.pricing !== null;

  return (
    <div className={`page-shell task-shell task-shell-${view}`}>
      {view === "plan" ? (
        <>
          <h1 className="sr-only">오늘의 플랜</h1>
          <AppHeaderActions>
            <details ref={overflowRef} className="workspace-overflow">
              <summary>
                <span className="sr-only">플랜 메뉴</span>
                <span aria-hidden="true">•••</span>
              </summary>
              <div className="workspace-overflow-panel">
                <button
                  className="button-link"
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={newPlanDialogOpen}
                  disabled={isSaving || plan.items.length === 0}
                  onClick={() => {
                    if (overflowRef.current) overflowRef.current.open = false;
                    setNewPlanDialogOpen(true);
                  }}
                >
                  새 플랜 시작
                </button>
                {newPlanDialogOpen && (
                  <NewPlanDialog
                    count={plan.items.length}
                    isSaving={isSaving}
                    onConfirm={() => void startNewPlan()}
                    onOpenChange={setNewPlanDialogOpen}
                  />
                )}
                <Link className="workspace-menu-link" href="/import#storage-status">
                  저장소 상태 도움말
                </Link>
                <a className="workspace-menu-link" href="/ticket#managed-shares">
                  내 공유 관리
                </a>
                <p>
                  {plan.items.length === 0
                    ? "현재 플랜은 이미 비어 있습니다."
                    : "현재 플랜을 명시적으로 교체합니다."}
                </p>
              </div>
            </details>
          </AppHeaderActions>
        </>
      ) : (
        <header className="workspace-header">
          <div>
            <p className="step-label">
              곡 담기{" "}
              <span className="serial-meta" aria-hidden="true">
                LEDGER / 02
              </span>
            </p>
            <h1>곡 찾기</h1>
            <p className="workspace-status-line">
              곡 제목, 가수, 초성이나 TJ·KY 번호로 찾아 담아보세요.
            </p>
          </div>
        </header>
      )}
      {error && (
        <div className="global-error" role="alert">
          <p>{error}</p>
          <button className="button-link" type="button" onClick={dismissError}>
            닫기
          </button>
        </div>
      )}
      {resetBackup && (
        <div className="undo-bar plan-reset-undo" role="status">
          <span>이전 {resetBackup.items.length}곡 플랜을 잠시 보관하고 있습니다.</span>
          <button
            className="button-link"
            type="button"
            disabled={isSaving}
            onClick={() => void undoNewPlan()}
          >
            이전 플랜 되돌리기
          </button>
        </div>
      )}
      {view === "search" ? (
        <SearchLedger
          onAdd={addCatalogTrack}
          onManualAdd={addManualTrack}
          onUndoCatalogAdd={undoCatalogAdd}
          isManualDuplicate={isManualDuplicate}
          addedCatalogIds={new Set(plan.items.flatMap((item) => item.catalogSongId ?? []))}
          isFull={plan.items.length >= 100}
          autoFocus
        />
      ) : (
        <div className="working-session-strip">
          <WorkingStrip
            items={plan.items}
            people={plan.people}
            disabled={isSaving}
            onAddPerson={() => void addParticipant()}
            onMove={(index, direction) => void move(index, direction)}
            onRemove={(index) => void remove(index)}
            undoLabel={removed?.track.title ?? null}
            onUndo={() => void undo()}
          />
          {plan.items.length > 0 && (
            <>
              <CalculationStrip
                ref={calculationRef}
                plan={plan}
                disabled={isSaving}
                onApply={applyCalculation}
              />
              <HomeActionDock
                songCount={plan.items.length}
                canIssue={canIssue}
                disabled={isSaving}
                onIssue={() => void issueTicket()}
                onOpenPricing={() => calculationRef.current?.openPricingAndFocusFirstInvalid()}
              />
            </>
          )}
        </div>
      )}
      <p className="save-announcement" aria-live="polite">
        {notice ?? (isSaving ? "이 기기에 저장하는 중…" : "")}
      </p>
      {view === "search" && (
        <BottomSlot>
          <PlanRail plan={plan} />
        </BottomSlot>
      )}
    </div>
  );
}
