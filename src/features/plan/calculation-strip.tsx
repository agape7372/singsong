"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  calculateCostRange,
  calculatePlan,
  estimateDuration,
  maxAffordablePrefix,
  roundDurationOutward,
} from "@/domain/calculation";
import type { Plan, PricingConfig } from "@/domain/models";
import { trackAnalytics } from "@/analytics/port";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function formatWonRange(lowWon: number, highWon: number) {
  const low = won.format(lowWon);
  return lowWon === highWon ? low : `${low}–${won.format(highWon)}`;
}

function positiveInteger(form: FormData, name: string) {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export type CalculationStripHandle = {
  openPricingAndFocusFirstInvalid: () => void;
};

type CalculationStripProps = {
  plan: Plan;
  disabled: boolean;
  onApply: (people: number, pricing: PricingConfig) => Promise<boolean>;
};

export const CalculationStrip = forwardRef<CalculationStripHandle, CalculationStripProps>(
  function CalculationStrip({ plan, disabled, onApply }, ref) {
    const [budget, setBudget] = useState("");
    const activated = useRef(false);
    const pricingDisclosureRef = useRef<HTMLDetailsElement>(null);
    const pricingFormRef = useRef<HTMLFormElement>(null);
    const pricingFormKey = JSON.stringify([plan.people, plan.pricing]);
    const authoritativeMode = plan.pricing?.kind ?? "song";
    const [formState, setFormState] = useState<{
      pricingFormKey: string;
      mode: "song" | "time";
      error: string | null;
    }>(() => ({ pricingFormKey, mode: authoritativeMode, error: null }));
    let resolvedFormState = formState;
    if (formState.pricingFormKey !== pricingFormKey) {
      resolvedFormState = { pricingFormKey, mode: authoritativeMode, error: null };
      setFormState(resolvedFormState);
    }
    const mode = resolvedFormState.mode;
    const formError = resolvedFormState.error;

    function setMode(nextMode: "song" | "time") {
      setFormState({ pricingFormKey, mode: nextMode, error: null });
    }

    function setFormError(error: string | null) {
      setFormState((current) => ({
        pricingFormKey,
        mode: current.pricingFormKey === pricingFormKey ? current.mode : authoritativeMode,
        error,
      }));
    }

    const calculation = useMemo(() => {
      if (plan.items.length === 0 || plan.people === null || plan.pricing === null) return null;
      try {
        return calculatePlan(plan.items.length, plan.pricing, plan.people);
      } catch {
        return null;
      }
    }, [plan.items.length, plan.people, plan.pricing]);

    const duration = useMemo(
      () => roundDurationOutward(estimateDuration(plan.items.length)),
      [plan.items.length],
    );

    const cost = useMemo(() => {
      if (plan.items.length === 0 || plan.pricing === null) return null;
      try {
        return calculateCostRange(plan.items.length, plan.pricing);
      } catch {
        return null;
      }
    }, [plan.items.length, plan.pricing]);

    const durationLabel =
      duration.lowMinutes === duration.highMinutes
        ? `${duration.lowMinutes}분`
        : `${duration.lowMinutes}–${duration.highMinutes}분`;
    const costLabel =
      plan.pricing === null
        ? "요금 입력 필요"
        : cost
          ? formatWonRange(cost.lowWon, cost.highWon)
          : "요금 확인 필요";

    const reverse = useMemo(() => {
      if (!plan.pricing || !/^\d+$/u.test(budget)) return null;
      const amount = Number(budget);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) return null;
      return maxAffordablePrefix(plan.items.length, amount, plan.pricing);
    }, [budget, plan.items.length, plan.pricing]);

    async function apply(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setFormError(null);
      const form = new FormData(event.currentTarget);
      const people = positiveInteger(form, "people");
      if (!people || people > 30) {
        setFormError("인원은 1명부터 30명 사이로 입력해 주세요.");
        return;
      }
      let pricing: PricingConfig;
      if (mode === "song") {
        const singlePriceWon = positiveInteger(form, "singlePriceWon");
        const bundleSongs = positiveInteger(form, "bundleSongs");
        const bundlePriceWon = positiveInteger(form, "bundlePriceWon");
        if (!singlePriceWon || singlePriceWon > 10_000_000) {
          setFormError("낱곡 가격을 1원부터 1천만 원 사이로 입력해 주세요.");
          return;
        }
        if ((bundleSongs === null) !== (bundlePriceWon === null)) {
          setFormError("묶음 곡 수와 묶음 가격은 함께 입력하거나 둘 다 비워 주세요.");
          return;
        }
        if ((bundleSongs ?? 1) > 100 || (bundlePriceWon ?? 1) > 10_000_000) {
          setFormError("묶음 값의 범위를 확인해 주세요.");
          return;
        }
        pricing = {
          kind: "song",
          singlePriceWon,
          ...(bundleSongs && bundlePriceWon
            ? { bundle: { songs: bundleSongs, priceWon: bundlePriceWon } }
            : {}),
        };
      } else {
        const blockMinutes = positiveInteger(form, "blockMinutes");
        const blockPriceWon = positiveInteger(form, "blockPriceWon");
        if (!blockMinutes || blockMinutes > 1_440 || !blockPriceWon || blockPriceWon > 10_000_000) {
          setFormError("시간 단위는 1–1,440분, 가격은 1원–1천만 원으로 입력해 주세요.");
          return;
        }
        pricing = { kind: "time", blockSeconds: blockMinutes * 60, blockPriceWon };
      }
      if (!(await onApply(people, pricing))) {
        setFormError("다른 탭의 변경을 확인한 뒤 다시 적용해 주세요.");
        return;
      }
      const pricingDisclosure = pricingDisclosureRef.current;
      const pricingSummary = pricingDisclosure?.querySelector<HTMLElement>("summary");
      if (pricingDisclosure) pricingDisclosure.open = false;
      pricingSummary?.focus({ preventScroll: true });
      if (!activated.current && plan.items.length >= 3) {
        activated.current = true;
        trackAnalytics({ name: "plan_activated" });
      }
    }

    function openPricingAndFocusFirstInvalid() {
      if (pricingDisclosureRef.current) pricingDisclosureRef.current.open = true;
      const form = pricingFormRef.current;
      if (!form) return;
      const target = form.querySelector<HTMLElement>(
        "input:invalid, select:invalid, textarea:invalid, input[name='people']",
      );
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    useImperativeHandle(ref, () => ({
      openPricingAndFocusFirstInvalid,
    }));

    return (
      <section className="calculation-strip" aria-labelledby="calculation-title">
        <h2 className="sr-only" id="calculation-title">
          시간과 비용 예상
        </h2>
        <details ref={pricingDisclosureRef} className="pricing-disclosure">
          <summary className="estimate-strip">
            <span className="estimate-cell estimate-cell-time">
              <span className="estimate-label">시간</span>
              <strong className="estimate-value">약 {durationLabel}</strong>
            </span>
            <span className="estimate-cell estimate-cell-cost">
              <span className="estimate-label">예상 비용</span>
              <strong className="estimate-value">{costLabel}</strong>
            </span>
            <span className="estimate-disclosure-label sr-only">상세 요금과 인원 설정</span>
          </summary>
          <div className="pricing-disclosure-body calculation-expanded-panel">
            <div className="calculation-form-side">
              <div className="section-heading">
                <div>
                  <p className="step-label">
                    계산하기{" "}
                    <span className="serial-meta" aria-hidden="true">
                      CALC / 02
                    </span>
                  </p>
                  <h3>현장 요금과 인원</h3>
                </div>
              </div>
              <p className="section-copy">
                현장 가격표 그대로 입력하면 범위로 계산해요. 임의의 값은 미리 채우지 않아요.
              </p>
              <form
                key={pricingFormKey}
                ref={pricingFormRef}
                className="pricing-form"
                onSubmit={(event) => void apply(event)}
              >
                <fieldset className="mode-fieldset">
                  <legend>과금 방식</legend>
                  <label>
                    <input
                      type="radio"
                      name="pricingMode"
                      value="song"
                      checked={mode === "song"}
                      onChange={() => setMode("song")}
                    />
                    곡 요금
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pricingMode"
                      value="time"
                      checked={mode === "time"}
                      onChange={() => setMode("time")}
                    />
                    시간 요금
                  </label>
                </fieldset>
                <label>
                  <span>나눌 인원</span>
                  <input
                    name="people"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    defaultValue={plan.people ?? ""}
                    placeholder="예: 3"
                    required
                  />
                </label>
                {mode === "song" ? (
                  <div className="field-grid">
                    <label>
                      <span>낱곡 가격 (원)</span>
                      <input
                        name="singlePriceWon"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10_000_000}
                        defaultValue={
                          plan.pricing?.kind === "song" ? plan.pricing.singlePriceWon : ""
                        }
                        placeholder="가격표의 낱곡 가격"
                        required
                      />
                    </label>
                    <span aria-hidden="true" />
                    <label>
                      <span>묶음 곡 수 (선택)</span>
                      <input
                        name="bundleSongs"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        defaultValue={
                          plan.pricing?.kind === "song" ? plan.pricing.bundle?.songs : ""
                        }
                      />
                    </label>
                    <label>
                      <span>묶음 가격 (원)</span>
                      <input
                        name="bundlePriceWon"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10_000_000}
                        defaultValue={
                          plan.pricing?.kind === "song" ? plan.pricing.bundle?.priceWon : ""
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="field-grid">
                    <label>
                      <span>시간 단위 (분)</span>
                      <input
                        name="blockMinutes"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={1_440}
                        defaultValue={
                          plan.pricing?.kind === "time" ? plan.pricing.blockSeconds / 60 : ""
                        }
                        placeholder="예: 30"
                        required
                      />
                    </label>
                    <label>
                      <span>단위 가격 (원)</span>
                      <input
                        name="blockPriceWon"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10_000_000}
                        defaultValue={
                          plan.pricing?.kind === "time" ? plan.pricing.blockPriceWon : ""
                        }
                        required
                      />
                    </label>
                  </div>
                )}
                {formError && (
                  <p className="field-error" role="alert">
                    {formError}
                  </p>
                )}
                <button className="button-secondary" type="submit" disabled={disabled}>
                  계산에 적용
                </button>
              </form>
            </div>
            <div className="calculation-result-side">
              {calculation ? (
                <>
                  <div className="calculation-summary" aria-live="polite" aria-atomic="true">
                    <p className="result-kicker">
                      <span>계산 결과</span>
                      <span className="serial-meta" aria-hidden="true">
                        CURRENT RANGE · {calculation.songCount}곡
                      </span>
                    </p>
                    <dl className="calculation-dl">
                      <div>
                        <dt>예상 시간</dt>
                        <dd>
                          {calculation.displayDuration.lowMinutes}–
                          {calculation.displayDuration.highMinutes}분
                        </dd>
                      </div>
                      <div>
                        <dt>총 비용</dt>
                        <dd>
                          {won.format(calculation.derived.totalLowWon)}
                          {calculation.derived.totalLowWon !== calculation.derived.totalHighWon &&
                            `–${won.format(calculation.derived.totalHighWon)}`}
                        </dd>
                      </div>
                      <div>
                        <dt>1인당</dt>
                        <dd>
                          {won.format(calculation.derived.perPersonLowWon)}
                          {calculation.derived.perPersonLowWon !==
                            calculation.derived.perPersonHighWon &&
                            `–${won.format(calculation.derived.perPersonHighWon)}`}
                        </dd>
                      </div>
                    </dl>
                    <p className="coverage-note">
                      평균 곡 길이 기준이에요. 대기·간주·재선곡 시간은 빠져 있어요.
                    </p>
                  </div>
                  <details className="budget-helper">
                    <summary>예산 안에 몇 곡인지 계산하기</summary>
                    <div className="budget-helper-body">
                      <label>
                        <span>예산 (원)</span>
                        <input
                          value={budget}
                          onChange={(event) => setBudget(event.target.value)}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100_000_000}
                          placeholder="예산 원 단위"
                        />
                      </label>
                      {reverse?.kind === "song" && (
                        <p>현재 순서 앞에서 최대 {reverse.maxSongs}곡까지 가능합니다.</p>
                      )}
                      {reverse?.kind === "time" && (
                        <p>
                          확실히 {reverse.guaranteedSongs}곡, 짧게 끝나면 {reverse.possibleSongs}
                          곡까지 가능해요.
                        </p>
                      )}
                      {reverse && <small>목록을 자동으로 줄이지 않아요.</small>}
                    </div>
                  </details>
                </>
              ) : (
                <div className="empty-calculation" aria-live="polite" aria-atomic="true">
                  <p className="result-kicker">
                    <span>계산 대기</span>
                    <span className="serial-meta" aria-hidden="true">
                      RANGE WAITING
                    </span>
                  </p>
                  <h3>요금과 인원을 입력하면 바로 계산해요.</h3>
                  <p>한 숫자로 단정하지 않고, 달라질 수 있는 시간과 비용을 범위로 보여줘요.</p>
                </div>
              )}
            </div>
          </div>
        </details>
      </section>
    );
  },
);
