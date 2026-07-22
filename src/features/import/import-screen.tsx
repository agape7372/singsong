"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { canonicalizeSharedSnapshot } from "@/domain/canonical";
import type { SharedSnapshot } from "@/domain/models";
import { importSharedPlan } from "@/data/plan-database";
import { useActivePlan } from "@/features/plan/use-active-plan";
import { TicketCard } from "@/features/ticket/ticket-card";
import { trackAnalytics } from "@/analytics/port";

const SLUG = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

type Probe = {
  idbAvailable: boolean | null;
  persisted: "true" | "false" | "unknown";
  inAppHint: boolean;
  standalone: boolean;
};

type StatusTone = "info" | "error" | null;

function normalizeImportInput(input: string) {
  const trimmed = input.trim();
  if (SLUG.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.origin !== window.location.origin || url.search || url.hash) return null;
    const match = /^\/s\/([A-Za-z0-9_-]{21}[AQgw])$/u.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function ImportScreen() {
  const { plan, error: planError } = useActivePlan();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState(searchParams.get("slug") ?? "");
  const [slug, setSlug] = useState<string | null>(null);
  const [payload, setPayload] = useState<SharedSnapshot | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [probe, setProbe] = useState<Probe>({
    idbAvailable: null,
    persisted: "unknown",
    inAppHint: false,
    standalone: false,
  });

  useEffect(() => {
    void (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const inAppHint = /KAKAOTALK|Instagram|FBAN|FBAV|Line\//iu.test(navigator.userAgent);
      const idbAvailable = "indexedDB" in window;
      let persisted: Probe["persisted"] = "unknown";
      try {
        if (navigator.storage?.persisted)
          persisted = String(await navigator.storage.persisted()) as "true" | "false";
      } catch {
        persisted = "unknown";
      }
      setProbe({ idbAvailable, persisted, inAppHint, standalone });
    })();
  }, []);

  async function lookup(raw: string) {
    const normalized = normalizeImportInput(raw);
    if (!normalized) {
      setInputError("이 사이트의 정확한 티켓 주소 또는 22자 코드를 입력해 주세요.");
      setStatus(null);
      setStatusTone(null);
      setPayload(null);
      setSlug(null);
      setExpiresAt(null);
      return;
    }
    setLoading(true);
    setInputError(null);
    setStatus(null);
    setStatusTone(null);
    setPayload(null);
    setSlug(null);
    setExpiresAt(null);
    try {
      const response = await fetch(`/api/shares/${normalized}`, { cache: "no-store" });
      const body = (await response.json()) as {
        payload?: unknown;
        expiresAt?: string;
        error?: { message?: string };
      };
      if (!response.ok || !body.payload || !body.expiresAt) {
        throw new Error(body.error?.message ?? "이 티켓을 찾을 수 없습니다.");
      }
      setPayload(canonicalizeSharedSnapshot(body.payload));
      setSlug(normalized);
      setExpiresAt(body.expiresAt);
      setStatus("티켓 무결성을 확인했습니다.");
      setStatusTone("info");
    } catch (error) {
      setPayload(null);
      setSlug(null);
      setExpiresAt(null);
      setStatus(error instanceof Error ? error.message : "이 티켓을 찾을 수 없습니다.");
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("slug");
    const timer = initial ? window.setTimeout(() => void lookup(initial), 0) : null;
    // Search params are intentionally consumed only once; input changes require explicit submit.
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(input);
  }

  async function confirmImport() {
    if (!plan || !payload || !slug) return;
    setLoading(true);
    try {
      const result = await importSharedPlan(plan.revision, slug, payload);
      if (result.status === "already-imported") {
        setStatus("이미 이 브라우저로 가져온 플랜입니다.");
        setStatusTone("info");
        setDialogOpen(false);
        return;
      }
      setStatus(probe.standalone ? "설치한 싱송에 저장했습니다." : "이 브라우저에 저장했습니다.");
      setStatusTone("info");
      trackAnalytics({ name: "import_saved" });
      setDialogOpen(false);
      router.push("/");
    } catch {
      setStatus("다른 탭에서 플랜이 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.");
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }

  if (!plan && planError) {
    return (
      <section className="page-shell narrow-shell state-strip state-strip-error" role="alert">
        <p className="eyebrow">저장소 확인 필요</p>
        <h1>가져올 플랜 저장소를 열지 못했어요.</h1>
        <p className="lede state-strip-copy">{planError}</p>
        <button className="button" type="button" onClick={() => window.location.reload()}>
          저장소 다시 확인
        </button>
      </section>
    );
  }

  return (
    <section className="page-shell import-shell" aria-labelledby="import-title">
      <header className="import-header">
        <p className="eyebrow">직접 확인 후 가져오기</p>
        <h1 id="import-title">공유 티켓 가져오기</h1>
        <p className="lede import-intro">
          받은 티켓을 먼저 확인한 뒤 이 브라우저의 활성 플랜으로 저장합니다. 자동 동기화나
          공동편집은 시작되지 않습니다.
        </p>
      </header>
      <form className="import-form" onSubmit={submit} aria-busy={loading} noValidate>
        <label htmlFor="import-value">티켓 주소 또는 22자 코드</label>
        <p id="import-input-help" className="import-help">
          주소 전체를 서버에 넘기지 않고, 이 사이트의 정확한 티켓 코드만 확인합니다.
        </p>
        <div className="import-field">
          <input
            id="import-value"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (inputError) setInputError(null);
            }}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={
              inputError ? "import-input-help import-input-error" : "import-input-help"
            }
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="go"
            spellCheck={false}
          />
          <button className="button-secondary" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? "확인 중…" : "티켓 확인"}
          </button>
        </div>
        {inputError && (
          <p id="import-input-error" className="import-error" role="alert">
            {inputError}
          </p>
        )}
      </form>
      <p
        className={`import-status${statusTone === "error" ? " import-status-error" : ""}`}
        role={statusTone === "error" ? "alert" : "status"}
        aria-live={statusTone === "error" ? "assertive" : "polite"}
      >
        {status}
      </p>
      <details className="storage-probe-details">
        <summary>이 브라우저의 저장 환경</summary>
        <dl id="storage-status" className="storage-probe">
          <div>
            <dt>브라우저 저장소</dt>
            <dd>
              {probe.idbAvailable === null
                ? "확인 중"
                : probe.idbAvailable
                  ? "사용 가능"
                  : "사용 불가"}
            </dd>
          </div>
          <div>
            <dt>자동 삭제 보호</dt>
            <dd>
              {probe.persisted === "true"
                ? "보호됨"
                : probe.persisted === "false"
                  ? "브라우저 정책에 따름"
                  : "확인할 수 없음"}
            </dd>
          </div>
          <div>
            <dt>인앱 브라우저</dt>
            <dd>{probe.inAppHint ? "감지됨" : "감지되지 않음"}</dd>
          </div>
          <div>
            <dt>설치 앱</dt>
            <dd>{probe.standalone ? "앱에서 실행 중" : "브라우저에서 실행 중"}</dd>
          </div>
        </dl>
      </details>
      {probe.inAppHint && (
        <p className="handoff-warning">
          인앱 브라우저로 보입니다. 저장 위치가 외부 브라우저나 설치 앱으로 이어진다고 보장할 수
          없습니다. 사용할 브라우저에서 같은 링크를 다시 열고 가져오기를 완료해 주세요.
        </p>
      )}
      {payload && slug && (
        <section className="import-preview" aria-labelledby="import-preview-title">
          <header className="import-preview-heading">
            <p className="eyebrow">가져올 티켓</p>
            <h2 id="import-preview-title">내용을 확인해 주세요.</h2>
          </header>
          <TicketCard
            payload={payload}
            testData={process.env.NEXT_PUBLIC_APP_PROFILE === "fixture"}
            headingLevel="h3"
          />
          <div className="import-preview-meta">
            <p>
              공유 링크 만료:{" "}
              {expiresAt ? (
                <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString("ko-KR")}</time>
              ) : (
                "확인 중"
              )}
            </p>
            <p>
              가져오기는 이 브라우저의 활성 플랜을 한 번만 바꾸며, 원본 티켓은 수정하지 않습니다.
            </p>
          </div>
          <AlertDialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialog.Trigger className="button" disabled={!plan || loading}>
              이 브라우저에 가져오기
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="dialog-backdrop" />
              <AlertDialog.Viewport className="dialog-viewport">
                <AlertDialog.Popup className="dialog-popup">
                  <AlertDialog.Title>
                    {plan?.items.length ? "현재 플랜을 바꿀까요?" : "이 티켓으로 시작할까요?"}
                  </AlertDialog.Title>
                  <AlertDialog.Description>
                    {plan?.items.length
                      ? `현재 ${plan.items.length}곡은 자동 보관되거나 합쳐지지 않습니다. 취소한 뒤 기존 세션 티켓을 발급해 남길 수 있습니다.`
                      : "티켓의 곡 순서와 계산 설정을 이 브라우저의 활성 플랜으로 저장합니다."}
                  </AlertDialog.Description>
                  <div className="button-row">
                    <AlertDialog.Close className="button-secondary">취소</AlertDialog.Close>
                    <button
                      className={plan?.items.length ? "button-danger" : "button"}
                      type="button"
                      onClick={() => void confirmImport()}
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading
                        ? "가져오는 중…"
                        : plan?.items.length
                          ? "현재 플랜 바꾸기"
                          : "가져오기"}
                    </button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Viewport>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </section>
      )}
    </section>
  );
}
