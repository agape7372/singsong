import { z } from "zod";
import artwork from "./ticket-artwork.json";

/**
 * 티켓 그림의 단일 정본.
 *
 * 같은 티켓을 세 경로가 각자 그린다 — 화면 DOM, PNG 내보내기(html-to-image가 만든 `<img>` 안),
 * 공유 OG 이미지(Satori → resvg). 좌표·색·문구를 세 번 적으면 한쪽만 고쳐지고 어긋나므로,
 * 그림은 `ticket-artwork.json` 한 곳에 선언하고 여기서는 해석만 한다.
 *
 * 세 경로 모두를 통과하려면 만들어지는 SVG가 자립해야 한다.
 * - 그레인은 feTurbulence를 쓴다(Blink·resvg 모두 지원).
 * - 하프톤은 feImage(같은 문서의 다른 요소 참조)를 쓰지 않는다. `<img>` 안에서 래스터화될 때
 *   문서 참조가 막힐 수 있어서, pattern + clipPath + 불투명도 램프로 같은 인상을 만든다.
 */

const PALETTE_KEYS = [
  "paper",
  "ink",
  "inkMuted",
  "accent",
  "accentText",
  "money",
  "border",
  "hole",
] as const;

const paletteKey = z.enum(PALETTE_KEYS);
const hex = z.string().regex(/^#[0-9a-f]{6}$/u, "팔레트는 소문자 6자리 hex만 쓴다");
const viewBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const grainSchema = z.object({
  baseFrequency: z.number().positive(),
  octaves: z.number().int().positive(),
  opacity: z.number().min(0).max(1),
  blend: z.enum(["multiply", "normal"]),
});

const shapeSchema = z.union([
  z.object({
    kind: z.literal("circle"),
    cx: z.number(),
    cy: z.number(),
    r: z.number().positive(),
    fill: paletteKey,
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    fill: paletteKey,
    opacity: z.number().min(0).max(1).optional(),
    rotate: z.object({ deg: z.number(), cx: z.number(), cy: z.number() }).optional(),
  }),
  z.object({
    kind: z.literal("path"),
    d: z.string().min(1),
    fill: paletteKey,
    opacity: z.number().min(0).max(1).optional(),
  }),
]);

const artworkSchema = z.object({
  version: z.literal(1),
  palette: z.object({
    paper: hex,
    ink: hex,
    inkMuted: hex,
    accent: hex,
    accentText: hex,
    money: hex,
    border: hex,
    hole: hex,
  }),
  radiusPx: z.number().positive(),
  composition: z.object({
    viewBox,
    shapes: z.array(shapeSchema).min(1),
    grain: grainSchema,
  }),
  cardGrain: grainSchema,
  halftone: z.object({
    viewBox,
    cellPx: z.number().positive(),
    dotRadiusPx: z.number().positive(),
    dotCoreStop: z.number().min(0).max(1),
    toneStops: z.array(z.tuple([z.number().min(0).max(1), z.string()])).min(2),
    thresholdGain: z.number(),
    thresholdBias: z.number(),
    fontSizePx: z.number().positive(),
    baselineY: z.number(),
  }),
  punch: z.object({
    dotPx: z.number().positive(),
    pitchPx: z.number().positive(),
    insetPx: z.number(),
    topPx: z.number(),
    bottomPx: z.number(),
    innerStop: z.number(),
    outerStop: z.number(),
  }),
  copy: z.object({
    kicker: z.string().min(1),
    title: z.string().min(1),
    countLabel: z.string().min(1),
    validity: z.string().min(1),
    serialPrefix: z.string(),
    testData: z.string().min(1),
  }),
});

export const ARTWORK = artworkSchema.parse(artwork);
export type TicketArtwork = z.infer<typeof artworkSchema>;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export const TICKET_PALETTE = ARTWORK.palette;
export const TICKET_RADIUS_PX = ARTWORK.radiusPx;
export const TICKET_COPY = ARTWORK.copy;

const FONT_STACK =
  'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, -apple-system, sans-serif';

export const TICKET_FONT_STACK = FONT_STACK;

function color(key: PaletteKey) {
  return TICKET_PALETTE[key];
}

function attr(name: string, value: string | number | undefined) {
  return value === undefined ? "" : ` ${name}="${value}"`;
}

function shapeMarkup(shape: TicketArtwork["composition"]["shapes"][number]) {
  const fill = attr("fill", color(shape.fill)) + attr("fill-opacity", shape.opacity);
  if (shape.kind === "circle") {
    return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${fill}/>`;
  }
  if (shape.kind === "path") {
    return `<path d="${shape.d}"${fill}/>`;
  }
  const rotate = shape.rotate
    ? ` transform="rotate(${shape.rotate.deg} ${shape.rotate.cx} ${shape.rotate.cy})"`
    : "";
  return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"${fill}${rotate}/>`;
}

function grainMarkup(grain: TicketArtwork["cardGrain"], id: string, width: number, height: number) {
  const blend = grain.blend === "multiply" ? ` style="mix-blend-mode:multiply"` : "";
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${grain.baseFrequency}" numOctaves="${grain.octaves}" stitchTiles="stitch" result="noise"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 6 -3"/>` +
    `</filter>` +
    `<rect width="${width}" height="${height}" filter="url(#${id})" opacity="${grain.opacity}"${blend}/>`
  );
}

/** 기하 컴포지션 + 그레인. 폭·높이만 주면 어느 렌더러에서도 같은 그림이 나온다. */
export function compositionSvg({
  width,
  height,
  idPrefix,
  background,
}: {
  width: number;
  height: number;
  idPrefix: string;
  background?: PaletteKey;
}) {
  const [minX, minY, boxWidth, boxHeight] = ARTWORK.composition.viewBox;
  const grainId = `${idPrefix}-composition-grain`;
  const backdrop = background
    ? `<rect x="${minX}" y="${minY}" width="${boxWidth}" height="${boxHeight}" fill="${color(background)}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="${minX} ${minY} ${boxWidth} ${boxHeight}" preserveAspectRatio="xMidYMid slice">` +
    backdrop +
    ARTWORK.composition.shapes.map(shapeMarkup).join("") +
    grainMarkup(ARTWORK.composition.grain, grainId, boxWidth, boxHeight) +
    `</svg>`
  );
}

/** 카드 전체를 덮는 리소 종이 그레인. 밴드에만 그레인이 있으면 경계선이 보인다. */
export function cardGrainSvg({
  width,
  height,
  idPrefix,
}: {
  width: number;
  height: number;
  idPrefix: string;
}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
    grainMarkup(ARTWORK.cardGrain, `${idPrefix}-grain`, width, height) +
    `</svg>`
  );
}

/**
 * 하프톤 "무늬"만 담은 타일. 글자 모양은 없다.
 *
 * 화면 티켓과 **같은 방식**으로 만든다 — 톤 그라디언트에 도트 스크린을 곱한 뒤 임계값을
 * 걸어서, 아래로 갈수록 **도트가 굵어진다**. (균일 도트에 불투명도만 깔면 격자무늬로 보인다.)
 *
 * 화면 구현이 쓰던 `feImage href="#..."`(같은 문서의 다른 요소 참조)만 걷어냈다. 곱셈을
 * 필터 밖에서 `mix-blend-mode: multiply`로 미리 해 두면 필터는 임계값만 걸면 되고, 그러면
 * `<img>` 안(PNG)과 resvg(OG)에서도 그대로 그려진다.
 *
 * SVG `<text>`는 폰트가 없는 래스터라이저에서 안 그려지므로 글자는 각 렌더러가 그리고,
 * 이 무늬를 `background-clip: text`로 글자에 입힌다.
 */
export function halftoneTextureSvg({ sizePx, idPrefix }: { sizePx: number; idPrefix: string }) {
  const { dotCoreStop, toneStops, thresholdGain, thresholdBias, fontSizePx } = ARTWORK.halftone;
  // 글자 높이에 대한 셀 비율을 화면 티켓과 똑같이 유지한다. 타일을 글자 크기에 맞춰
  // 늘이면(background-size: 100%) 렌더러마다 셀이 달라져 망점 굵기가 제각각이 된다.
  const round = (value: number) => Number(((value / fontSizePx) * sizePx).toFixed(3));
  const cellPx = round(ARTWORK.halftone.cellPx);
  const dotRadiusPx = round(ARTWORK.halftone.dotRadiusPx);
  const width = sizePx;
  const height = sizePx;
  const dot = `${idPrefix}-dot`;
  const screen = `${idPrefix}-screen`;
  const tone = `${idPrefix}-tone`;
  const threshold = `${idPrefix}-threshold`;
  const gain = thresholdGain;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}">` +
    `<defs>` +
    // 도트 스크린: 중심이 밝고 가장자리로 갈수록 어두운 원 타일.
    `<radialGradient id="${dot}">` +
    `<stop offset="0" stop-color="#ffffff"/>` +
    `<stop offset="${dotCoreStop}" stop-color="#ffffff"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</radialGradient>` +
    `<pattern id="${screen}" width="${cellPx}" height="${cellPx}" patternUnits="userSpaceOnUse">` +
    `<rect width="${cellPx}" height="${cellPx}" fill="#000000"/>` +
    `<circle cx="${cellPx / 2}" cy="${cellPx / 2}" r="${dotRadiusPx}" fill="url(#${dot})"/>` +
    `</pattern>` +
    // 톤 램프: 위는 솔리드(검정), 아래로 갈수록 밝아져 임계를 넘는 면적이 커진다.
    `<linearGradient id="${tone}" x1="0" y1="0" x2="0" y2="1">` +
    toneStops
      .map(([offset, stopColor]) => `<stop offset="${offset}" stop-color="${stopColor}"/>`)
      .join("") +
    `</linearGradient>` +
    `<filter id="${threshold}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${gain} ${gain} ${gain} 0 ${thresholdBias}" result="dots"/>` +
    `<feFlood flood-color="${color("paper")}" result="ink"/>` +
    `<feComposite in="ink" in2="dots" operator="in"/>` +
    `</filter>` +
    `</defs>` +
    `<g filter="url(#${threshold})" style="isolation:isolate">` +
    `<rect width="${width}" height="${height}" fill="url(#${tone})"/>` +
    `<rect width="${width}" height="${height}" fill="url(#${screen})" style="mix-blend-mode:multiply"/>` +
    `</g>` +
    `</svg>`
  );
}

/** 좌우 타공 열의 CSS 값. 화면(의사요소)과 PNG(실제 div)가 같은 수치를 쓴다. */
export function punchColumnStyle(side: "left" | "right") {
  const { dotPx, pitchPx, insetPx, topPx, bottomPx, innerStop, outerStop } = ARTWORK.punch;
  return {
    position: "absolute" as const,
    top: `${topPx}px`,
    bottom: `${bottomPx}px`,
    [side]: `${insetPx}px`,
    width: `${dotPx}px`,
    backgroundImage: `radial-gradient(circle, ${color("hole")} ${innerStop}%, transparent ${outerStop}%)`,
    backgroundRepeat: "repeat-y",
    backgroundPosition: "center",
    backgroundSize: `${dotPx}px ${pitchPx}px`,
  };
}

/** SVG 문자열을 Satori·`<img>`가 받아들이는 data URI로 감싼다. */
export function svgDataUri(svg: string) {
  const base64 =
    typeof Buffer === "undefined"
      ? btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function formatWon(value: number) {
  return won.format(value);
}

export function formatWonRange(lowWon: number, highWon: number) {
  const low = won.format(lowWon);
  return lowWon === highWon ? low : `${low}–${won.format(highWon)}`;
}

/** 5분 단위로 낮은 쪽은 내리고 높은 쪽은 올린다. 화면 뒷면과 OG가 같은 값을 보여야 한다. */
export function formatMinuteRange(lowSec: number, highSec: number) {
  const low = Math.floor(lowSec / 300) * 5;
  const high = Math.ceil(highSec / 300) * 5;
  return low === high ? `${low}분` : `${low}–${high}분`;
}

export function ticketSerial(fingerprint: string | undefined, artworkSeed: string) {
  return fingerprint ? fingerprint.slice(0, 10).toUpperCase() : artworkSeed.slice(0, 10);
}
