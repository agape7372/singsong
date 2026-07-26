import type { Skia, SkColor } from "@shopify/react-native-skia";

import raw from "./ticket-artwork.json";

/**
 * `src/features/ticket/ticket-artwork.json` 의 **바이트 동일 복사본**을 읽는다.
 * 상수를 손으로 옮기면 한 자리 틀려도 티가 안 나므로 파일째 복사했다
 * (해시 대조 완료). M1 에서 `packages/ticket-art` 로 승격하며 사본은 사라진다.
 */
export const ARTWORK = raw;

/**
 * Skia 팩토리 묶음의 타입. 앱은 `@shopify/react-native-skia` 의 `Skia` 를 넣고,
 * 헤드리스 검증 하네스(`tools/verify-halftone.mjs`)는 CanvasKit 기반
 * `JsiSkApi(CanvasKit)` 를 넣는다 — 같은 인터페이스라 그리는 코드는 하나로 유지된다.
 *
 * 이 파일과 `halftone/grain/punch` 는 값(value)으로는 RN 을 전혀 import 하지 않는다.
 * 열거형과 타입만 가져오므로 Node 에서도 그대로 실행된다. 실제 `Skia` 를 묶어 주는
 * 앱 진입점은 `./index` 하나뿐이다.
 */
export type SkiaApi = typeof Skia;

export type PaletteKey = keyof typeof raw.palette;

export function hex(key: PaletteKey): string {
  return raw.palette[key];
}

export function color(skia: SkiaApi, key: PaletteKey): SkColor {
  return skia.Color(raw.palette[key]);
}

/**
 * 하프톤 타일은 글자 크기에 비례한다. `ticket-art.ts:223` 의 `round()` 와 같은 식이어야
 * 셀 굵기가 화면·PNG·OG 에서 같은 비율로 유지된다.
 */
export function scaleToTile(value: number, sizePx: number): number {
  return Number(((value / raw.halftone.fontSizePx) * sizePx).toFixed(3));
}
