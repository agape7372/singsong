import {
  Skia,
  type SkCanvas,
  type SkColor,
  type SkImage,
  type SkPaint,
} from "@shopify/react-native-skia";

import * as artwork from "./artwork";
import * as grain from "./grain";
import * as halftone from "./halftone";
import * as punch from "./punch";
import * as ticketScene from "./ticket-scene";

import type { TicketScene } from "@singsong/ticket-art";

/**
 * 앱에서 쓰는 진입점. **RN 의 `Skia` 를 값으로 import 하는 곳은 여기 하나뿐이다.**
 *
 * `artwork/halftone/grain/punch` 는 `SkiaApi` 를 인자로 받는 순수 빌더라
 * Node 에서도 그대로 실행된다 — `tools/verify-halftone.mjs` 가 CanvasKit `JsiSkApi` 를
 * 넣어 같은 코드로 PNG 를 떠서 원본 SVG 와 픽셀 대조한다.
 */

export { ARTWORK, hex, scaleToTile, type PaletteKey, type SkiaApi } from "./artwork";
export { punchGeometry } from "./punch";
export { thresholdMatrix } from "./halftone";

export function color(key: artwork.PaletteKey): SkColor {
  return artwork.color(Skia, key);
}

export function makeDotTile(sizePx: number): SkImage | null {
  return halftone.makeDotTile(Skia, sizePx);
}

export function makeHalftoneShader(tile: SkImage, sizePx: number, top: number) {
  return halftone.makeHalftoneShader(Skia, tile, sizePx, top);
}

export function makeHalftonePaint(tile: SkImage, sizePx: number, top: number): SkPaint {
  return halftone.makeHalftonePaint(Skia, tile, sizePx, top);
}

export function makeGrainPaint(spec: {
  baseFrequency: number;
  octaves: number;
  opacity: number;
  tileWidth: number;
  tileHeight: number;
}): SkPaint {
  return grain.makeGrainPaint(Skia, spec);
}

export function drawPunchColumn(
  canvas: SkCanvas,
  spec: { x: number; top: number; height: number; holeColor: SkColor },
) {
  return punch.drawPunchColumn(Skia, canvas, spec);
}

/** Same scene backend is used by the on-screen Picture and the CPU PNG export. */
export function recordTicketScene(scene: TicketScene) {
  return ticketScene.recordTicketScene(Skia, scene);
}

export function rasterizeTicketScene(scene: TicketScene) {
  return ticketScene.rasterizeTicketScene(Skia, scene);
}
