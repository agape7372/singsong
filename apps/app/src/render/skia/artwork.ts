import type { Skia, SkColor } from "@shopify/react-native-skia";

import { ARTWORK, scaleToTile, type PaletteKey } from "@singsong/ticket-art";

/**
 * M2부터 앱도 `@singsong/ticket-art` 정본을 직접 읽는다.
 * 이 파일은 Skia 타입을 결합하는 얇은 어댑터일 뿐 값을 복사하지 않는다.
 */
export { ARTWORK, scaleToTile };

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

export type { PaletteKey };

export function hex(key: PaletteKey): string {
  return ARTWORK.palette[key];
}

export function color(skia: SkiaApi, key: PaletteKey): SkColor {
  return skia.Color(ARTWORK.palette[key]);
}
