import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";
import { getShareRepository } from "@/features/share/repository.server";
import type { ShareRecord } from "@/features/share/types";

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

const palettes = [
  { accent: "#FF3D6E", accentSoft: "#F2EDE3" },
  { accent: "#F5A623", accentSoft: "#FFF4D7" },
  { accent: "#3B64D8", accentSoft: "#EDF1FF" },
] as const;

function choosePalette(share: ShareRecord | null) {
  if (!share) return palettes[0];
  const seed = share.payload.artworkSeed;
  return palettes[seed.charCodeAt(0) % palettes.length] ?? palettes[0];
}

function displayMinutes(seconds: number, direction: "down" | "up") {
  const round = direction === "down" ? Math.floor : Math.ceil;
  return round(seconds / 300) * 5;
}

function displayRange(low: number, high: number, format: (value: number) => string) {
  const start = format(low);
  const end = format(high);
  return start === end ? start : `${start}—${end}`;
}

function OgArtwork({ share }: { share: ShareRecord | null }) {
  const palette = choosePalette(share);
  const calculation = share?.payload.calculation;
  const duration = calculation
    ? displayRange(
        displayMinutes(calculation.duration.lowSec, "down"),
        displayMinutes(calculation.duration.highSec, "up"),
        String,
      )
    : null;
  const price = calculation
    ? displayRange(calculation.derived.totalLowWon, calculation.derived.totalHighWon, (value) =>
        value.toLocaleString("en-US"),
      )
    : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 50,
        background: "#FAF7F0",
        color: "#15131A",
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
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          border: "4px solid #15131A",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            height: 18,
            width: "100%",
            display: "flex",
            background: palette.accent,
            borderBottom: "4px solid #15131A",
          }}
        />
        {share && calculation ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "34px 42px 32px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ color: palette.accent, fontSize: 22, letterSpacing: "0.14em" }}>
                  SINGSONG · SESSION
                </div>
                <div style={{ marginTop: 10, fontSize: 52, letterSpacing: "-0.045em" }}>
                  함께 부를 세션 티켓
                </div>
              </div>
              <div
                style={{
                  minWidth: 176,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  border: "4px solid #15131A",
                  padding: "10px 18px 12px",
                  background: palette.accentSoft,
                }}
              >
                <span style={{ fontSize: 66, lineHeight: 1 }}>
                  {String(calculation.songCount).padStart(2, "0")}
                </span>
                <span style={{ marginLeft: 8, fontSize: 24 }}>곡</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                borderTop: "3px dashed #9B7F8A",
                borderBottom: "3px dashed #9B7F8A",
              }}
            >
              <Metric label="예상 시간" value={`${duration} MIN`} />
              <Metric label="예상 비용" value={`KRW ${price}`} bordered />
              <Metric label="명 기준" value={String(calculation.people)} bordered />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
              <span>UNLISTED · 30 DAYS</span>
              <span>#{share.fingerprint.slice(0, 10).toUpperCase()}</span>
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
            <div style={{ color: palette.accent, fontSize: 23, letterSpacing: "0.14em" }}>
              SINGSONG · UNAVAILABLE
            </div>
            <div style={{ marginTop: 18, fontSize: 58, letterSpacing: "-0.045em" }}>
              링크를 열 수 없습니다
            </div>
            <div style={{ marginTop: 26, color: "#6B5D6E", fontSize: 28 }}>
              만료되었거나 잘못된 주소입니다
            </div>
            <div style={{ marginTop: 10, color: "#6B5D6E", fontSize: 28 }}>
              주소를 다시 확인해 주세요
            </div>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 270,
            left: -18,
            width: 36,
            height: 36,
            display: "flex",
            border: "4px solid #15131A",
            borderRadius: "50%",
            background: "#FAF7F0",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 270,
            right: -18,
            width: 36,
            height: 36,
            display: "flex",
            border: "4px solid #15131A",
            borderRadius: "50%",
            background: "#FAF7F0",
          }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px",
        borderLeft: bordered ? "2px solid #F0DCE4" : "0 solid transparent",
      }}
    >
      <span style={{ color: "#6B5D6E", fontSize: 20 }}>{label}</span>
      <span style={{ marginTop: 4, fontSize: 32 }}>{value}</span>
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
