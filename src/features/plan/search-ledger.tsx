"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { CatalogTrack } from "@/features/catalog/types";
import { isValidSearchQuery, normalizeSearchText } from "@/domain/catalog";
import { FIXTURE_CATALOG } from "@/features/catalog/fixture";

const fixtureBuild = process.env.NEXT_PUBLIC_APP_PROFILE !== "production";
const SUGGESTIONS: readonly CatalogTrack[] = fixtureBuild ? FIXTURE_CATALOG.slice(0, 6) : [];

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "hint"; message: string }
  | { kind: "success"; results: CatalogTrack[] }
  | { kind: "error"; message: string };

export type ManualTrackInput = {
  title: string;
  artist: string;
  karaokeCode: string;
  karaokeVendor: "TJ" | "KY";
};

export function SearchLedger({
  onAdd,
  onManualAdd,
  onUndoCatalogAdd,
  isManualDuplicate,
  addedCatalogIds,
  isFull,
  autoFocus = false,
}: {
  onAdd: (track: CatalogTrack) => Promise<boolean> | boolean;
  onManualAdd: (input: ManualTrackInput) => Promise<boolean> | boolean;
  onUndoCatalogAdd: (catalogSongId: string) => Promise<boolean> | boolean;
  isManualDuplicate: (input: ManualTrackInput) => boolean;
  addedCatalogIds: ReadonlySet<string>;
  isFull: boolean;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [isComposing, setIsComposing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [pendingManualSignature, setPendingManualSignature] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<CatalogTrack | null>(null);
  const sequence = useRef(0);
  const queryId = useId();
  const manualFormId = useId();
  const invalidSearchMessage =
    !isComposing && query.trim().length > 0 && !isValidSearchQuery(query)
      ? "일반 검색어는 2~60자, 노래방 번호는 숫자 1~6자로 입력해 주세요."
      : null;
  const displayedState: SearchState = invalidSearchMessage
    ? { kind: "hint", message: invalidSearchMessage }
    : state;
  const statusMessage = (() => {
    switch (displayedState.kind) {
      case "idle":
        return "검색어는 주소나 로그에 남기지 않습니다.";
      case "loading":
        return fixtureBuild ? "가상 목록을 찾는 중…" : "곡 목록을 찾는 중…";
      case "hint":
      case "error":
        return displayedState.message;
      case "success":
        if (displayedState.results.length === 0) {
          return fixtureBuild ? "일치하는 테스트 곡이 없습니다." : "일치하는 곡이 없습니다.";
        }
        return `검색 결과 ${displayedState.results.length}곡`;
    }
  })();
  const hasNoResults = displayedState.kind === "success" && displayedState.results.length === 0;

  useEffect(() => {
    const normalized = query.trim();
    if (isComposing || normalized.length === 0) {
      return;
    }
    if (!isValidSearchQuery(normalized)) {
      return;
    }

    const controller = new AbortController();
    const currentSequence = ++sequence.current;
    const timer = window.setTimeout(() => {
      setState({ kind: "loading" });
      void fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized, limit: 20 }),
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as {
            results?: CatalogTrack[];
            error?: { message?: string };
          };
          if (!response.ok) throw new Error(body.error?.message ?? "검색을 마치지 못했습니다.");
          return body.results ?? [];
        })
        .then((results) => {
          if (currentSequence === sequence.current) setState({ kind: "success", results });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || currentSequence !== sequence.current) return;
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "검색을 마치지 못했습니다.",
          });
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isComposing, query]);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setManualError(null);
    const form = new FormData(formElement);
    const input: ManualTrackInput = {
      title: String(form.get("title") ?? "").trim(),
      artist: String(form.get("artist") ?? "").trim(),
      karaokeCode: String(form.get("karaokeCode") ?? "").trim(),
      karaokeVendor: form.get("karaokeVendor") === "KY" ? "KY" : "TJ",
    };
    if (!input.title) {
      setManualError("곡 제목을 입력해 주세요.");
      return;
    }
    if (Array.from(input.title).length > 80 || Array.from(input.artist).length > 80) {
      setManualError("곡 제목과 가수는 각각 80자 이내로 입력해 주세요.");
      return;
    }
    if (input.karaokeCode && !/^\d+$/.test(input.karaokeCode)) {
      setManualError("노래방 번호는 숫자만 입력해 주세요.");
      return;
    }
    const manualSignature = `${normalizeSearchText(input.title)}\u0000${normalizeSearchText(input.artist)}`;
    if (isManualDuplicate(input) && pendingManualSignature !== manualSignature) {
      setPendingManualSignature(manualSignature);
      setManualError(
        "같은 제목과 가수의 곡이 이미 있습니다. 별도 곡으로 담으려면 한 번 더 눌러 주세요.",
      );
      return;
    }
    if (await onManualAdd(input)) {
      formElement.reset();
      setManualOpen(false);
      setPendingManualSignature(null);
    }
  }

  return (
    <section className="ledger search-ledger" aria-labelledby="search-ledger-title">
      <h2 className="sr-only" id="search-ledger-title">
        부를 곡 찾기
      </h2>
      <div className="search-ledger-head">
        <label className="sr-only" htmlFor={queryId}>
          제목, 가수 또는 노래방 번호로 곡 찾기
        </label>
        <div className="search-input-wrap">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <input
            id={queryId}
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length === 0) setState({ kind: "idle" });
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setIsComposing(false);
              setQuery(event.currentTarget.value);
            }}
            type="search"
            maxLength={120}
            placeholder="곡 제목, 가수, 초성으로 찾아봐"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <p
          className="search-status-line"
          data-state={displayedState.kind}
          role={displayedState.kind === "error" ? "alert" : "status"}
          aria-live={displayedState.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {statusMessage}
        </p>
      </div>
      {fixtureBuild && (
        <p className="search-testdata-note">
          <span className="test-data-badge" aria-hidden="true">
            TEST DATA
          </span>
          권리 검증용 가상 목록이에요.
        </p>
      )}
      <div className="search-results" aria-busy={displayedState.kind === "loading"}>
        {displayedState.kind === "idle" && SUGGESTIONS.length > 0 && (
          <div className="search-suggestions">
            <p className="search-suggestions-title">이런 곡 어때?</p>
            <ul className="result-list" aria-label="추천 곡">
              {SUGGESTIONS.map((track, index) => {
                const isAdded = addedCatalogIds.has(track.id);
                return (
                  <li className="search-result-row" key={track.id}>
                    <span className="search-result-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="search-result-copy">
                      <strong>{track.title}</strong>
                      <span>{track.artist}</span>
                    </div>
                    {isAdded ? (
                      <span
                        className="result-added-status"
                        aria-label={`${track.title}, ${track.artist} 담김`}
                      >
                        <span aria-hidden="true">✓</span> 담김
                      </span>
                    ) : (
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() =>
                          void Promise.resolve(onAdd(track)).then((added) => {
                            if (added) setLastAdded(track);
                          })
                        }
                        disabled={isFull}
                        aria-label={`${track.title}, ${track.artist} 담기`}
                      >
                        담기
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {displayedState.kind === "idle" && SUGGESTIONS.length === 0 && (
          <div className="quiet-state search-idle-state">
            <p>제목이 바로 안 떠오르면 초성이나 TJ·KY 번호로 찾아봐요.</p>
          </div>
        )}
        {displayedState.kind === "loading" && (
          <ul className="result-list search-loading-list" aria-hidden="true">
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
        )}
        {displayedState.kind === "error" && (
          <div className="inline-error search-recovery-actions">
            <button className="button-link" type="button" onClick={() => setQuery(`${query} `)}>
              다시 시도
            </button>
            <Link className="button-link" href="/">
              플랜에서 계속하기
            </Link>
          </div>
        )}
        {hasNoResults && (
          <div className="quiet-state search-empty-state">
            <div>
              <strong>찾는 곡이 안 보여요.</strong>
              <p>다른 표기·초성·번호로 다시 찾거나 직접 입력해 보세요.</p>
            </div>
            {!manualOpen && (
              <button
                className="button-link"
                type="button"
                aria-expanded="false"
                aria-controls={manualFormId}
                onClick={() => setManualOpen(true)}
              >
                직접 입력하기
              </button>
            )}
          </div>
        )}
        {displayedState.kind === "success" && displayedState.results.length > 0 && (
          <ul className="result-list" aria-label={`검색 결과 ${displayedState.results.length}개`}>
            {displayedState.results.map((track, index) => {
              const isAdded = addedCatalogIds.has(track.id);
              return (
                <li className="search-result-row" key={track.id}>
                  <span className="search-result-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="search-result-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                    <small>
                      {Object.entries(track.karaokeCodes)
                        .map(([vendor, code]) => `${vendor} ${code}`)
                        .join(" · ")}
                    </small>
                  </div>
                  {isAdded ? (
                    <span
                      className="result-added-status"
                      aria-label={`${track.title}, ${track.artist} 담김`}
                    >
                      <span aria-hidden="true">✓</span> 담김
                    </span>
                  ) : (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() =>
                        void Promise.resolve(onAdd(track)).then((added) => {
                          if (added) setLastAdded(track);
                        })
                      }
                      disabled={isFull}
                      aria-label={`${track.title}, ${track.artist} 담기`}
                    >
                      담기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {lastAdded && addedCatalogIds.has(lastAdded.id) && (
        <div className="undo-bar" role="status">
          <span>‘{lastAdded.title}’ 담았어요.</span>
          <button
            className="button-link"
            type="button"
            onClick={() =>
              void Promise.resolve(onUndoCatalogAdd(lastAdded.id)).then((undone) => {
                if (undone) setLastAdded(null);
              })
            }
          >
            되돌리기
          </button>
        </div>
      )}
      {(!hasNoResults || manualOpen) && (
        <div className="manual-toggle-row">
          <button
            className="button-secondary"
            type="button"
            aria-expanded={manualOpen}
            aria-controls={manualFormId}
            onClick={() => setManualOpen((open) => !open)}
          >
            {manualOpen ? "직접 입력 닫기" : "목록에 없나요? 직접 입력"}
          </button>
        </div>
      )}
      {manualOpen && (
        <form
          className="manual-form"
          id={manualFormId}
          onSubmit={(event) => void submitManual(event)}
        >
          <div className="field-grid">
            <label>
              <span>곡 제목</span>
              <input name="title" required maxLength={160} />
            </label>
            <label>
              <span>가수</span>
              <input name="artist" maxLength={160} />
            </label>
          </div>
          <div className="field-grid">
            <label>
              <span>번호 회사</span>
              <select name="karaokeVendor" defaultValue="TJ">
                <option value="TJ">TJ</option>
                <option value="KY">KY</option>
              </select>
            </label>
            <label>
              <span>노래방 번호 (선택)</span>
              <input name="karaokeCode" inputMode="numeric" pattern="[0-9]*" maxLength={6} />
            </label>
          </div>
          {manualError && (
            <p className="field-error" role="alert">
              {manualError}
            </p>
          )}
          <button className="button" type="submit" disabled={isFull}>
            플랜에 담기
          </button>
        </form>
      )}
    </section>
  );
}
