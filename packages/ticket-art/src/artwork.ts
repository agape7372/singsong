import { z } from "zod";

/**
 * 그림 상수의 정본. 사본을 뜨지 않는다.
 *
 * 이 파일이 곧 정본이 된 경위 — 원래 정본은 Next 트리의
 * `src/features/ticket/ticket-artwork.json` 이었고 여기서 `../../../` 로 거슬러 올라가
 * 읽었다. 의도(정본 1벌 유지)는 옳았지만 **방향이 거꾸로였다**: 계획 §4 M6 이
 * Next 트리를 삭제하므로, 살아남을 패키지가 죽을 트리를 물고 있는 형태였다.
 * 그날 이 패키지는 빌드 불가가 된다. 그래서 JSON 을 이쪽으로 옮기고(R100) 화살표를
 * 뒤집었다 — 이제 Next 트리가 패키지를 참조한다.
 *
 * 아직 남은 사본 1장: `apps/app/src/render/skia/ticket-artwork.json`. apps/app 이
 * 워크스페이스 멤버가 아니라 `@singsong/*` 를 해석할 수 없어서(M2 로 연기) 지금은
 * 지울 수 없다. 대신 `tools/check-monorepo.mjs` 가 두 파일의 바이트 동일성을
 * 매 게이트마다 강제한다 — "한 번 대조했다" 를 영구 불변식으로 바꿔 둔 것이다.
 * M2 에서 앱이 `@singsong/ticket-art` 를 import 하게 되면 그 사본과 검사를 함께 지운다.
 *
 * **데이터만** 공유한다 — `ticket-art.ts` 모듈을 import 하면 SVG 문자열 인터프리터와
 * `Buffer` 의존까지 네이티브 번들에 딸려 들어온다(C2 에서 `Intl` 의존은 제거됐다).
 */
// import attribute(`with { type: "json" }`)는 Node ESM 이 JSON 을 로드할 때 요구한다.
// 없으면 맨 Node 에서 ERR_IMPORT_ATTRIBUTE_MISSING(M1 게이트 tools/gate-m1.mjs 가 실측으로
// 잡았다) — vite/vitest/webpack 은 관대해 통과시키지만 위 index.ts 주석의 "Node 에서 그대로
// 돈다" 는 이 한 줄이 없으면 거짓이었다. ES2025 표준이라 세 번들러 모두 수용한다.
import artwork from "./ticket-artwork.json" with { type: "json" };

const hex = z.string().regex(/^#[0-9a-f]{6}$/u, "팔레트는 소문자 6자리 hex만 쓴다");
const unit = z.number().min(0).max(1);
const viewBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const grainSchema = z.object({
  baseFrequency: z.number().positive(),
  octaves: z.number().int().positive(),
  opacity: unit,
  blend: z.enum(["multiply", "normal"]),
});

const shapeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("circle"),
    cx: z.number(),
    cy: z.number(),
    r: z.number().positive(),
    fill: z.string(),
    opacity: unit.optional(),
  }),
  z.object({
    kind: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    fill: z.string(),
    opacity: unit.optional(),
    rotate: z.object({ deg: z.number(), cx: z.number(), cy: z.number() }).optional(),
  }),
  z.object({
    kind: z.literal("path"),
    d: z.string().min(1),
    fill: z.string(),
    opacity: unit.optional(),
  }),
]);

/**
 * 원본 스키마(`ticket-art.ts:32-113`)와 같은 계약을 다시 세운다. 두 벌인 게 아니라
 * **이쪽이 살아남는 쪽**이다 — 원본은 M6 에서 파일째 사라진다. 그때까지 둘 다 같은 JSON 을
 * 읽으므로, 값이 어긋나면 웹·네이티브 중 한쪽이 아니라 양쪽이 동시에 죽는다.
 */
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
    dotCoreStop: unit,
    toneStops: z.array(z.tuple([unit, hex])).min(2),
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

export type TicketArtwork = z.infer<typeof artworkSchema>;
export type Palette = TicketArtwork["palette"];
export type PaletteKey = keyof Palette;
export type ArtworkShape = TicketArtwork["composition"]["shapes"][number];

export const ARTWORK: TicketArtwork = artworkSchema.parse(artwork);
export const TICKET_COPY = ARTWORK.copy;

/** 씬이 노출하는 유일한 테마 축. `export`·`og` 는 이 값을 받지 않는다(scene.ts 참조). */
export type Theme = "light" | "dark";

/**
 * 다크 티켓 팔레트.
 *
 * JSON 에는 라이트 한 벌뿐이다 — 정본 §9-2 가 PNG·OG 를 항상 canonical light 로 못 박았고
 * (`docs/FINAL_BLUEPRINT.md:211`), 그 두 경로가 JSON 을 직접 읽기 때문이다. 그래서 다크 값은
 * 지금까지 CSS 에만 존재했다: `src/app/globals.css:80-89` 의 `--ticket-*` 오버라이드 8줄.
 *
 * 네이티브에는 CSS 커스텀 프로퍼티가 없으므로 그 8줄이 여기로 온다. JSON 에 `paletteDark`
 * 를 추가하는 승격은 M6 이다 — 지금 JSON 을 건드리면 라이트 팔레트가 CSS 와 일치하는지
 * 대조하는 계약(`globals.css:29-31`)의 대상 파일을 이동 전에 흔들게 된다.
 */
export const DARK_PALETTE: Palette = {
  paper: "#241c2a",
  ink: "#f5eef3",
  inkMuted: "#b8a9bc",
  accent: "#ff6b9b",
  accentText: "#ff8ab1",
  money: "#f5a623",
  border: "#88798d",
  hole: "#16111c",
};

export function resolvePalette(theme: Theme): Palette {
  return theme === "dark" ? DARK_PALETTE : ARTWORK.palette;
}

/**
 * 하프톤 타일은 글자 크기에 비례한다. `ticket-art.ts:223` 의 `round()` 와 **같은 식**이어야
 * 셀 굵기가 화면·PNG·OG 에서 같은 비율로 유지된다. 소수 셋째 자리 반올림까지 같이 옮긴다 —
 * 백엔드가 각자 반올림하면 10× 슈퍼샘플 단계에서 픽셀이 갈린다
 * (`apps/app/src/render/skia/halftone.ts:44-46`).
 */
export function scaleToTile(value: number, sizePx: number): number {
  return Number(((value / ARTWORK.halftone.fontSizePx) * sizePx).toFixed(3));
}
