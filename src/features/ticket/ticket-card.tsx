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
    fingerprint?: string | undefined;
    animate?: boolean | undefined;
    testData?: boolean | undefined;
    className?: string | undefined;
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
  const totalLow = won.format(calculation.derived.totalLowWon);
  const totalHigh = won.format(calculation.derived.totalHighWon);
  const totalLabel =
    calculation.derived.totalLowWon === calculation.derived.totalHighWon
      ? totalLow
      : `${totalLow}–${totalHigh}`;
  const serial = fingerprint
    ? fingerprint.slice(0, 10).toUpperCase()
    : payload.artworkSeed.slice(0, 10);
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
      {/* 카드 전체에 은은한 리소 종이 그레인 (콘텐츠 뒤) */}
      <svg
        className="ticket-riso-grain"
        viewBox="0 0 320 470"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <filter id={`grain-${headingId}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 6 -3"
          />
        </filter>
        <rect width="320" height="470" filter={`url(#grain-${headingId})`} />
      </svg>
      {/* 포스터 헤드: 거대 타이틀(미스레지) 위로 겹치는 핑크 하프톤 곡수(좌우 블리딩) */}
      <header className="ticket-poster">
        <p className="ticket-kicker">SINGSONG · 오늘의 세션</p>
        <Heading id={headingId} className="ticket-riso-title" data-text="오늘의 세션 스트립">
          오늘의 세션 스트립
        </Heading>
        <div className="ticket-numberplate" aria-hidden="true">
          <svg viewBox="0 0 320 128" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* 도트 스크린: 라디얼 그라데이션 점 타일 (임계값과 합성해 톤별 점 크기 변화) */}
              <radialGradient id={`dot-${headingId}`}>
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.55" stopColor="#fff" />
                <stop offset="1" stopColor="#000" />
              </radialGradient>
              <pattern
                id={`screen-${headingId}`}
                width="2.6"
                height="2.6"
                patternUnits="userSpaceOnUse"
              >
                <rect width="2.6" height="2.6" fill="#000" />
                <circle cx="1.3" cy="1.3" r="1.2" fill={`url(#dot-${headingId})`} />
              </pattern>
              {/* 톤 램프: 위=검정(솔리드), 중간(28%)부터 아래로 점이 완만히 커짐 */}
              <linearGradient id={`tone-${headingId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#000" />
                <stop offset="0.28" stopColor="#141414" />
                <stop offset="0.68" stopColor="#606060" />
                <stop offset="1" stopColor="#c8c8c8" />
              </linearGradient>
              {/* 진짜 하프톤: (톤×스크린) 임계값 → 톤에 따라 점 크기 변화 */}
              <filter
                id={`ht-${headingId}`}
                x="0"
                y="0"
                width="100%"
                height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  href={`#screen-src-${headingId}`}
                  x="0"
                  y="0"
                  width="320"
                  height="128"
                  preserveAspectRatio="none"
                  result="screen"
                />
                <feComposite
                  in="SourceGraphic"
                  in2="screen"
                  operator="arithmetic"
                  k1="1"
                  k2="0"
                  k3="0"
                  k4="0"
                  result="mult"
                />
                <feColorMatrix
                  in="mult"
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 14 14 0 -8.4"
                  result="dots"
                />
                <feFlood className="ticket-ht-ink" result="ink" />
                <feComposite in="ink" in2="dots" operator="in" />
              </filter>
              {/* feImage 소스 — defs 안이라 직접 렌더 안 되고 feImage만 참조 */}
              <rect
                id={`screen-src-${headingId}`}
                width="320"
                height="128"
                fill={`url(#screen-${headingId})`}
              />
              <clipPath id={`nclip-${headingId}`}>
                <text className="ticket-bignum" x="160" y="110" textAnchor="middle">
                  {calculation.songCount}
                </text>
              </clipPath>
            </defs>
            {/* 솔리드 핑크 숫자 (베이스) */}
            <text
              className="ticket-bignum"
              x="160"
              y="110"
              textAnchor="middle"
              fill="var(--card-accent)"
            >
              {calculation.songCount}
            </text>
            {/* 숫자 모양으로 클립된 크림 망점 (톤 램프로 아래일수록 점 커짐) */}
            <g clipPath={`url(#nclip-${headingId})`}>
              <rect
                width="320"
                height="128"
                fill={`url(#tone-${headingId})`}
                filter={`url(#ht-${headingId})`}
              />
            </g>
          </svg>
        </div>
        <p className="ticket-songcount">
          <span className="sr-only">{calculation.songCount}곡</span>
          <span aria-hidden="true">SONGS</span>
        </p>
        {fixtureBuild && testData && (
          <p className="ticket-test-data">TEST DATA · 실제 노래방 곡 목록이 아닙니다</p>
        )}
      </header>
      {/* 대담 겹침 기하 컴포지션 (멀티플 색섞임 + 리소 그레인) */}
      <div className="ticket-composition" aria-hidden="true">
        <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
          <g className="ticket-composition-shapes">
            <circle cx="56" cy="96" r="56" fill="var(--card-ink)" />
            <path d="M112 40h58v58a58 58 0 0 1-58-58z" fill="var(--card-accent)" />
            <path d="M112 156l30-58 30 58z" fill="var(--card-ink)" />
            <rect x="176" y="40" width="60" height="60" fill="var(--card-accent)" />
            <path d="M236 40h60v60a60 60 0 0 1-60-60z" fill="var(--card-ink)" />
            <circle cx="266" cy="150" r="52" fill="var(--card-accent)" />
            <path d="M176 200a44 44 0 0 1 88 0z" fill="var(--card-ink)" />
            <circle cx="150" cy="150" r="34" fill="var(--card-accent)" fillOpacity="0.6" />
            <rect
              x="60"
              y="140"
              width="46"
              height="46"
              fill="var(--card-money)"
              transform="rotate(16 83 163)"
            />
            <circle cx="40" cy="150" r="14" fill="var(--card-paper)" />
          </g>
          <rect
            className="ticket-composition-grain"
            width="320"
            height="200"
            filter={`url(#grain-${headingId})`}
          />
        </svg>
      </div>
      {/* 스텁: NO + 바코드 + ₩ 총액(오커) */}
      <footer className="ticket-footer">
        <span className="ticket-serial" aria-label="티켓 일련번호">
          NO. {serial}
        </span>
        <span className="ticket-barcode" aria-hidden="true" />
        <span className="ticket-stub-price">{totalLabel}</span>
        <span className="ticket-validity">공유 시 30일 · 검색 비노출</span>
      </footer>
    </motion.article>
  );
});
