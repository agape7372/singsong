"use client";

import { forwardRef, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { SharedSnapshot } from "@/domain/models";

const fixtureBuild = process.env.NEXT_PUBLIC_APP_PROFILE !== "production";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export const TicketCard = forwardRef<
  HTMLElement,
  {
    payload: SharedSnapshot;
    fingerprint?: string;
    animate?: boolean;
    testData?: boolean;
    className?: string;
    headingLevel: "h1" | "h2" | "h3";
  }
>(function TicketCard(
  { payload, fingerprint, animate = false, testData = false, className = "", headingLevel },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const headingId = useId();
  const { calculation } = payload;
  const Heading = headingLevel;
  const lowMinutes = Math.floor(calculation.duration.lowSec / 300) * 5;
  const highMinutes = Math.ceil(calculation.duration.highSec / 300) * 5;
  const summaryItems = payload.items.slice(0, 4);
  const remainingItems = payload.items.length - summaryItems.length;
  const pricingLabel = calculation.pricing.kind === "song" ? "곡당 요금" : "시간 요금";
  const initial = animate
    ? reducedMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 24, rotate: -0.6 }
    : false;

  return (
    <motion.article
      ref={ref}
      className={`ticket-card ${className}`.trim()}
      aria-labelledby={headingId}
      initial={initial}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: animate ? 0.36 : 0, ease: [0.22, 1, 0.36, 1] }}
      data-artwork-seed={payload.artworkSeed}
    >
      <header className="ticket-header">
        <div className="ticket-heading">
          <p className="ticket-kicker">발권 완료 · SINGSONG</p>
          <Heading id={headingId}>오늘의 세션 스트립</Heading>
        </div>
        <dl className="ticket-count">
          <div>
            <dt>곡 수</dt>
            <dd>{String(calculation.songCount).padStart(2, "0")}</dd>
          </div>
        </dl>
      </header>
      {fixtureBuild && testData && (
        <p className="ticket-test-data">TEST DATA · 실제 노래방 곡 목록이 아닙니다</p>
      )}
      <ol className="ticket-track-list">
        {summaryItems.map((item, index) => (
          <li key={`${item.order}-${item.title}-${item.artist}`}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div className="ticket-track-copy">
              <strong>{item.title}</strong>
              <small>{item.artist || "가수 미입력"}</small>
            </div>
            <small className="ticket-code">
              {item.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ") ||
                "직접 입력"}
            </small>
          </li>
        ))}
        {remainingItems > 0 && (
          <li className="ticket-more-items">
            <span aria-hidden="true">＋</span>
            <div className="ticket-track-copy">
              <strong>나머지 {remainingItems}곡</strong>
              <small>공유 티켓의 전체 곡 순서에서 확인</small>
            </div>
          </li>
        )}
      </ol>
      <section className="ticket-totals" aria-label="세션 계산 결과">
        <dl className="ticket-summary">
          <div>
            <dt>예상 시간</dt>
            <dd>
              {lowMinutes}–{highMinutes}분
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
            <dt>{calculation.people}명 · 1인당</dt>
            <dd>
              {won.format(calculation.derived.perPersonLowWon)}
              {calculation.derived.perPersonLowWon !== calculation.derived.perPersonHighWon &&
                `–${won.format(calculation.derived.perPersonHighWon)}`}
            </dd>
          </div>
        </dl>
        <p className="ticket-assumption">
          {pricingLabel} · 평균 곡 길이 기준 · 원 단위 올림 · 대기 시간 제외
        </p>
      </section>
      <footer className="ticket-footer">
        <span>공유 시 30일 · 검색 비노출</span>
        <span className="ticket-serial" aria-label="티켓 일련번호">
          {fingerprint ? fingerprint.slice(0, 10).toUpperCase() : payload.artworkSeed.slice(0, 10)}
        </span>
      </footer>
    </motion.article>
  );
});
