"use client";

/* eslint-disable @next/next/no-img-element -- html-to-image가 캡처하는 노드다.
   next/image의 loader·srcset은 캡처 경로에서 해석되지 않아 그림이 비게 된다. */

import { forwardRef } from "react";
import type { SharedSnapshot } from "@/domain/models";
import { formatWonRange } from "@/domain/format";
import {
  TICKET_COPY,
  TICKET_FONT_STACK,
  TICKET_PALETTE,
  TICKET_RADIUS_PX,
  cardGrainSvg,
  compositionSvg,
  halftoneTextureSvg,
  punchColumnStyle,
  svgDataUri,
  ticketSerial,
} from "./ticket-art";

/**
 * PNG 저장 전용 티켓.
 *
 * 화면용 `TicketCard`를 그대로 캡처하면 안 된다.
 * - html-to-image는 SVG 자식에 스타일을 복제하지 않는다 → `fill="var(--card-*)"`가
 *   전부 검정으로 떨어진다. 그래서 그림은 `ticket-art`가 만든 자립 SVG를 `<img>`로 넣는다.
 * - 화면 카드는 `%`/`dvh`/`min-height`와 조상(.flip-scene)의 폭에 의존한다 →
 *   캡처하면 폰 실측 px가 인라인으로 박혀 캔버스 좌측에만 그려진다.
 *   그래서 여기서는 모든 치수를 고정 px로 못 박는다.
 * - CSS 커스텀 프로퍼티도 쓰지 않는다(내보내기 경로에서 해석되지 않음).
 */

const WIDTH = 540;
const HEIGHT = 675;
const COMPOSITION_HEIGHT = 290;

const compositionUri = svgDataUri(
  compositionSvg({
    width: WIDTH,
    height: COMPOSITION_HEIGHT,
    idPrefix: "export",
    background: "paper",
  }),
);

const COUNT_FONT_PX = 152;

// 타일 한 장이 글자 높이와 같다. 세로로 램프가 정확히 한 번 걸리고, 가로로는 반복된다.
const halftoneTextureUri = svgDataUri(
  halftoneTextureSvg({ sizePx: COUNT_FONT_PX, idPrefix: "export" }),
);

// 카드 전체 그레인. 컴포지션 밴드에만 그레인이 있으면 종이와 밴드 사이에 경계선이 보인다.
const cardGrainUri = svgDataUri(
  cardGrainSvg({ width: WIDTH, height: HEIGHT, idPrefix: "export-card" }),
);

export const TicketExportCard = forwardRef<
  HTMLDivElement,
  {
    payload: SharedSnapshot;
    fingerprint?: string | undefined;
    testData?: boolean | undefined;
  }
>(function TicketExportCard({ payload, fingerprint, testData = false }, ref) {
  const { calculation } = payload;
  const totalLabel = formatWonRange(
    calculation.derived.totalLowWon,
    calculation.derived.totalHighWon,
  );
  const serial = ticketSerial(fingerprint, payload.artworkSeed);
  const countStyle = {
    fontSize: `${COUNT_FONT_PX}px`,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "-0.04em",
    fontVariantNumeric: "tabular-nums" as const,
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "relative",
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: `${TICKET_RADIUS_PX}px`,
        background: TICKET_PALETTE.paper,
        color: TICKET_PALETTE.ink,
        fontFamily: TICKET_FONT_STACK,
        colorScheme: "light",
      }}
    >
      {/* 카드 전체 그레인 (콘텐츠 뒤) */}
      <img
        src={cardGrainUri}
        width={WIDTH}
        height={HEIGHT}
        alt=""
        style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
      />
      {/* 좌우 타공 열 — 화면 티켓의 의사요소와 같은 수치를 실제 div로 그린다. */}
      <div style={{ ...punchColumnStyle("left"), zIndex: 2 }} />
      <div style={{ ...punchColumnStyle("right"), zIndex: 2 }} />

      {/* 헤더가 남는 높이를 흡수한다. 컴포지션·스텁은 고정이라 잘리지 않는다. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "26px 40px 0",
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          // 화면 티켓 포스터 헤드와 같은 중앙 정렬.
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            color: TICKET_PALETTE.accentText,
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.16em",
          }}
        >
          {TICKET_COPY.kicker}
        </p>
        <p
          style={{
            margin: "8px 0 0",
            color: TICKET_PALETTE.ink,
            fontSize: "40px",
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            textShadow: `4px 4px 0 ${TICKET_PALETTE.accent}`,
          }}
        >
          {TICKET_COPY.title}
        </p>
        {/* 로즈 숫자 위에 하프톤 무늬를 글자 모양으로 입힌다. */}
        <div style={{ position: "relative", display: "inline-block", margin: "4px 0 0" }}>
          <span style={{ ...countStyle, display: "block", color: TICKET_PALETTE.accent }}>
            {calculation.songCount}
          </span>
          <span
            style={{
              ...countStyle,
              position: "absolute",
              top: 0,
              left: 0,
              color: "transparent",
              backgroundImage: `url(${halftoneTextureUri})`,
              backgroundSize: `${COUNT_FONT_PX}px ${COUNT_FONT_PX}px`,
              backgroundRepeat: "repeat-x",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            {calculation.songCount}
          </span>
        </div>
        <p
          style={{
            margin: "2px 0 0",
            color: TICKET_PALETTE.ink,
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.36em",
          }}
        >
          {TICKET_COPY.countLabel}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: "none",
          height: `${COMPOSITION_HEIGHT}px`,
          marginTop: "12px",
        }}
      >
        <img src={compositionUri} width={WIDTH} height={COMPOSITION_HEIGHT} alt="" />
      </div>

      {/* 스텁 */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: "none",
          borderTop: `2px dashed ${TICKET_PALETTE.border}`,
          padding: "14px 40px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span
            style={{
              color: TICKET_PALETTE.ink,
              fontSize: "17px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {TICKET_COPY.serialPrefix}
            {serial}
          </span>
          <span
            style={{
              color: TICKET_PALETTE.money,
              fontSize: "22px",
              fontWeight: 900,
              letterSpacing: "0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalLabel}
          </span>
        </div>
        <div
          style={{
            height: "28px",
            margin: "10px 0 8px",
            background: `repeating-linear-gradient(90deg, ${TICKET_PALETTE.ink} 0 2px, transparent 2px 4px, ${TICKET_PALETTE.ink} 4px 7px, transparent 7px 11px)`,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{ color: TICKET_PALETTE.inkMuted, fontSize: "12px", letterSpacing: "0.04em" }}
          >
            {TICKET_COPY.validity}
          </span>
          {/* 헤더에 두면 675px 안에서 잘린다. 메타데이터가 모인 스텁이 제자리다. */}
          {testData && (
            <span
              style={{
                border: `1px solid ${TICKET_PALETTE.inkMuted}`,
                borderRadius: "999px",
                padding: "3px 8px",
                color: TICKET_PALETTE.inkMuted,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              TEST DATA
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
