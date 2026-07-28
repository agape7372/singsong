/**
 * `@singsong/ticket-art` — 티켓 그림의 정본 상수 + 디스플레이 리스트.
 *
 * 여기서 나온 `TicketScene` 하나를 백엔드 둘이 실행한다:
 *   ① Skia   — `apps/app/src/render/skia/` (M0 에서 하프톤·그레인·타공 프리미티브 완료)
 *   ② SVG 문자열 — 이 패키지의 `svg.ts` (공유 랜딩·서버 이미지 파이프라인)
 *
 * 이 패키지는 값으로 React·RN·DOM 을 전혀 import 하지 않는다. Node 에서 그대로 돈다.
 */
export {
  ARTWORK,
  DARK_PALETTE,
  TICKET_COPY,
  resolvePalette,
  scaleToTile,
  type ArtworkShape,
  type Palette,
  type PaletteKey,
  type Theme,
  type TicketArtwork,
} from "./artwork.js";

export {
  IDENTITY,
  SCENE_PRIMITIVE_KINDS,
  buildTicketScene,
  type Affine,
  type BarcodeBarsPrimitive,
  type CirclePrimitive,
  type DashLinePrimitive,
  type GhostTextPrimitive,
  type GrainPrimitive,
  type HalftoneGlyphsPrimitive,
  type PathPrimitive,
  type PunchColumnPrimitive,
  type QrModulesPrimitive,
  type RRectPrimitive,
  type RectPrimitive,
  type SceneAlign,
  type SceneBlend,
  type SceneFont,
  type ScenePrimitive,
  type ScenePrimitiveKind,
  type TextPrimitive,
  type TicketModel,
  type TicketScene,
  type TicketSceneOptions,
  type TicketVariant,
} from "./scene.js";

export { escapeTicketSvgText, renderTicketSceneSvg, type TicketSvgOptions } from "./svg.js";
