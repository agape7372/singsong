/* eslint-disable @next/next/no-img-element -- Satori는 next/image를 해석하지 못한다. 데이터 URI만 그린다. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";
import { getShareRepository } from "@/features/share/repository.server";
import type { ShareRecord } from "@/features/share/types";
import {
  TICKET_COPY,
  TICKET_PALETTE,
  TICKET_RADIUS_PX,
  compositionSvg,
  formatMinuteRange,
  formatWonRange,
  halftoneTextureSvg,
  svgDataUri,
} from "@/features/ticket/ticket-art";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const WIDTH = 1_200;
const HEIGHT = 630;
const SLUG = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

// 카드 기하. 타공 원은 절취선 위에 놓여야 하므로 좌표를 손으로 적지 않고 여기서 만든다.
const CARD_PADDING = 44;
const CARD_BORDER = 1;
const TEAR_BORDER = 2;
const STUB_WIDTH = 470;
const HOLE_DIAMETER = 36;
const CARD_INNER_WIDTH = WIDTH - CARD_PADDING * 2;
/** 절취선 중심 — 카드 안쪽 좌표계 기준. */
const TEAR_CENTER_X = CARD_INNER_WIDTH - CARD_BORDER - STUB_WIDTH - TEAR_BORDER / 2;
const HOLE_LEFT = TEAR_CENTER_X - HOLE_DIAMETER / 2;
const FONT_ASSET = new URL("../../../../assets/fonts/NotoSansKR-700.subset.ttf", import.meta.url);

function fontAssetPath() {
  // Webpack emits `new URL(..., import.meta.url)` as a traced `/_next/static`
  // asset beside the server chunks in a Node build. Vitest and unbundled Node
  // retain a native file URL.
  if (FONT_ASSET.pathname.startsWith("/_next/")) {
    return path.join(
      process.cwd(),
      ".next",
      "server",
      "chunks",
      FONT_ASSET.pathname.slice("/_next/".length),
    );
  }
  return fileURLToPath(String(FONT_ASSET));
}

const notoSansKr = readFile(fontAssetPath()).then((bytes) => Uint8Array.from(bytes).buffer);

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

// 컴포지션은 티켓마다 같은 그림이라 요청 시점에 다시 만들 이유가 없다.
// 폭은 반드시 스텁 폭과 같아야 한다 — 430 으로 만들어 470 으로 그리면 가로로 9% 늘어난다.
const COMPOSITION_HEIGHT = 250;
const compositionUri = svgDataUri(
  compositionSvg({
    width: STUB_WIDTH,
    height: COMPOSITION_HEIGHT,
    idPrefix: "og",
    background: "paper",
  }),
);

const COUNT_FONT_PX = 186;

// 타일 한 장이 글자 높이와 같다. 늘이지 않으므로 망점 굵기가 화면·PNG와 같은 비율로 유지된다.
const halftoneTextureUri = svgDataUri(
  halftoneTextureSvg({ sizePx: COUNT_FONT_PX, idPrefix: "og" }),
);

/**
 * 카톡·X는 이 1200×630 이미지를 폭 500px 안팎으로 줄여 띄운다. 그 크기에서 읽히지 않는
 * 장식(시리얼·바코드)은 넣지 않고, 정본 §9-5가 요구하는 제목·곡수·시간·비용만 크게 싣는다.
 */
function Metric({ label, value, tone }: { label: string; value: string; tone?: "money" }) {
  // 3열로 늘어놓으면 500px로 줄었을 때 값끼리 붙는다. 라벨 왼쪽·값 오른쪽 한 줄로 쌓는다.
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ color: TICKET_PALETTE.inkMuted, fontSize: 26 }}>{label}</span>
      <span
        style={{
          fontSize: 42,
          color: tone === "money" ? TICKET_PALETTE.money : TICKET_PALETTE.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** 악센트 글자 위에 종이색 망점을 겹쳐 찍는다 — 화면 티켓의 큰 숫자와 같은 기법. */
function HalftoneMark({ children }: { children: string }) {
  const glyph = {
    fontSize: COUNT_FONT_PX,
    lineHeight: 1,
    letterSpacing: "-0.05em",
  } as const;

  return (
    <div style={{ display: "flex", position: "relative", marginTop: 6 }}>
      <span style={{ ...glyph, color: TICKET_PALETTE.accent }}>{children}</span>
      <span
        style={{
          ...glyph,
          position: "absolute",
          top: 0,
          left: 0,
          color: "transparent",
          backgroundImage: `url(${halftoneTextureUri})`,
          backgroundSize: `${COUNT_FONT_PX}px ${COUNT_FONT_PX}px`,
          backgroundRepeat: "repeat-x",
          backgroundClip: "text",
        }}
      >
        {children}
      </span>
    </div>
  );
}

const POSTER_COLUMN = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  flex: 1,
  padding: "44px 36px",
} as const;

/**
 * 링크 프리뷰용 **정적** 브랜드판. 곡수·시간·비용은 티켓마다 다르므로 이미지에 굽지 않고
 * `og:title`/`og:description` 텍스트가 나른다(정본 §9-5, 계획 D5).
 */
function BrandArtwork() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <div style={POSTER_COLUMN}>
        <span style={{ color: TICKET_PALETTE.accentText, fontSize: 25, letterSpacing: "0.14em" }}>
          {TICKET_COPY.kicker}
        </span>
        <span style={{ marginTop: 14, fontSize: 64, letterSpacing: "-0.045em", lineHeight: 1.02 }}>
          {TICKET_COPY.title}
        </span>
        <HalftoneMark>싱송</HalftoneMark>
      </div>

      <div
        style={{
          display: "flex",
          width: 0,
          height: "100%",
          borderLeft: `${TEAR_BORDER}px dashed ${TICKET_PALETTE.border}`,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", width: STUB_WIDTH, height: "100%" }}>
        <img src={compositionUri} width={STUB_WIDTH} height={COMPOSITION_HEIGHT} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 10,
            flex: 1,
            padding: "34px 40px 32px",
          }}
        >
          <span style={{ fontSize: 34, letterSpacing: "-0.02em" }}>코인노래방 세션 플래너</span>
          <span style={{ color: TICKET_PALETTE.inkMuted, fontSize: 22 }}>
            {TICKET_COPY.validity}
          </span>
        </div>
      </div>
    </div>
  );
}

function OgArtwork({ share, brand }: { share: ShareRecord | null; brand: boolean }) {
  const calculation = share?.payload.calculation;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 44,
        background: TICKET_PALETTE.hole,
        color: TICKET_PALETTE.ink,
        fontFamily: "Noto Sans KR",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          border: `1px solid ${TICKET_PALETTE.border}`,
          borderRadius: TICKET_RADIUS_PX,
          background: TICKET_PALETTE.paper,
        }}
      >
        {brand ? (
          <BrandArtwork />
        ) : share && calculation ? (
          <div style={{ display: "flex", width: "100%", height: "100%" }}>
            {/* 왼쪽: 포스터 헤더 — 화면 티켓 앞면과 같은 정보 위계 */}
            <div style={POSTER_COLUMN}>
              <span
                style={{
                  color: TICKET_PALETTE.accentText,
                  fontSize: 25,
                  letterSpacing: "0.14em",
                }}
              >
                {TICKET_COPY.kicker}
              </span>
              <span
                style={{
                  marginTop: 14,
                  fontSize: 64,
                  letterSpacing: "-0.045em",
                  lineHeight: 1.02,
                }}
              >
                {TICKET_COPY.title}
              </span>
              {/* 로즈 숫자 위에 하프톤 무늬를 글자 모양으로 입힌다(화면·PNG와 같은 인상). */}
              <HalftoneMark>{String(calculation.songCount)}</HalftoneMark>
              <span style={{ marginTop: 4, fontSize: 24, letterSpacing: "0.36em" }}>
                {TICKET_COPY.countLabel}
              </span>
            </div>

            {/* 절취선 */}
            <div
              style={{
                display: "flex",
                width: 0,
                height: "100%",
                borderLeft: `${TEAR_BORDER}px dashed ${TICKET_PALETTE.border}`,
              }}
            />

            {/* 오른쪽: 컴포지션 + 스텁 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: STUB_WIDTH,
                height: "100%",
              }}
            >
              <img src={compositionUri} width={STUB_WIDTH} height={COMPOSITION_HEIGHT} alt="" />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  flex: 1,
                  padding: "34px 40px 32px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Metric
                    label="예상 시간"
                    value={formatMinuteRange(
                      calculation.duration.lowSec,
                      calculation.duration.highSec,
                    )}
                  />
                  <Metric
                    label="예상 비용"
                    value={formatWonRange(
                      calculation.derived.totalLowWon,
                      calculation.derived.totalHighWon,
                    )}
                    tone="money"
                  />
                  <Metric label="인원" value={`${calculation.people}명`} />
                </div>
                <span style={{ color: TICKET_PALETTE.inkMuted, fontSize: 22 }}>
                  {TICKET_COPY.validity}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "42px 54px",
            }}
          >
            <span
              style={{ color: TICKET_PALETTE.accentText, fontSize: 23, letterSpacing: "0.14em" }}
            >
              SINGSONG · 열 수 없는 링크
            </span>
            <span style={{ marginTop: 18, fontSize: 58, letterSpacing: "-0.045em" }}>
              링크를 열 수 없습니다
            </span>
            <span style={{ marginTop: 26, color: TICKET_PALETTE.inkMuted, fontSize: 28 }}>
              만료되었거나 잘못된 주소입니다
            </span>
            <span style={{ marginTop: 10, color: TICKET_PALETTE.inkMuted, fontSize: 28 }}>
              주소를 다시 확인해 주세요
            </span>
          </div>
        )}

        {/* 절취선 양끝 타공 — 화면 티켓의 타공 열과 같은 종이색 반원.
            좌표는 손으로 적지 않는다. 730 으로 적혀 있던 동안 절취선에서 106px 떨어져 떠 있었다. */}
        <div
          style={{
            position: "absolute",
            top: -HOLE_DIAMETER / 2,
            left: HOLE_LEFT,
            width: HOLE_DIAMETER,
            height: HOLE_DIAMETER,
            display: "flex",
            borderRadius: HOLE_DIAMETER / 2,
            background: TICKET_PALETTE.hole,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -HOLE_DIAMETER / 2,
            left: HOLE_LEFT,
            width: HOLE_DIAMETER,
            height: HOLE_DIAMETER,
            display: "flex",
            borderRadius: HOLE_DIAMETER / 2,
            background: TICKET_PALETTE.hole,
          }}
        />
      </div>
    </div>
  );
}

async function findShare(slug: string) {
  if (!SLUG.test(slug)) return null;
  try {
    return await getShareRepository().get(slug);
  } catch {
    // The preview must not reveal whether a capability is invalid, expired,
    // revoked, or temporarily unavailable.
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  // `?brand=1` 은 슬러그와 무관한 정적 브랜드판을 그린다. 링크 프리뷰용 PNG 를 한 번 뽑아
  // 커밋하기 위한 경로이며(계획 D5), 공유 데이터를 읽지 않는다.
  const brand = new URL(request.url).searchParams.get("brand") === "1";
  const [font, share] = await Promise.all([notoSansKr, brand ? null : findShare(slug)]);

  return new ImageResponse(<OgArtwork share={share} brand={brand} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }],
    headers: responseHeaders,
  });
}
