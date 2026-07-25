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
const compositionUri = svgDataUri(
  compositionSvg({ width: 430, height: 250, idPrefix: "og", background: "paper" }),
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

function OgArtwork({ share }: { share: ShareRecord | null }) {
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
        {share && calculation ? (
          <div style={{ display: "flex", width: "100%", height: "100%" }}>
            {/* 왼쪽: 포스터 헤더 — 화면 티켓 앞면과 같은 정보 위계 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                // 화면 티켓 포스터 헤드와 같은 중앙 정렬.
                alignItems: "center",
                textAlign: "center",
                flex: 1,
                padding: "44px 36px",
              }}
            >
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
              <div style={{ display: "flex", position: "relative", marginTop: 6 }}>
                <span
                  style={{
                    color: TICKET_PALETTE.accent,
                    fontSize: COUNT_FONT_PX,
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {calculation.songCount}
                </span>
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    fontSize: COUNT_FONT_PX,
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: "transparent",
                    backgroundImage: `url(${halftoneTextureUri})`,
                    backgroundSize: `${COUNT_FONT_PX}px ${COUNT_FONT_PX}px`,
                    backgroundRepeat: "repeat-x",
                    backgroundClip: "text",
                  }}
                >
                  {calculation.songCount}
                </span>
              </div>
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
                borderLeft: `2px dashed ${TICKET_PALETTE.border}`,
              }}
            />

            {/* 오른쪽: 컴포지션 + 스텁 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 470,
                height: "100%",
              }}
            >
              <img src={compositionUri} width={470} height={250} alt="" />
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

        {/* 절취선 양끝 타공 — 화면 티켓의 타공 열과 같은 종이색 반원 */}
        <div
          style={{
            position: "absolute",
            top: -18,
            left: 730,
            width: 36,
            height: 36,
            display: "flex",
            borderRadius: 18,
            background: TICKET_PALETTE.hole,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -18,
            left: 730,
            width: 36,
            height: 36,
            display: "flex",
            borderRadius: 18,
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

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const [font, share] = await Promise.all([notoSansKr, findShare(slug)]);

  return new ImageResponse(<OgArtwork share={share} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }],
    headers: responseHeaders,
  });
}
