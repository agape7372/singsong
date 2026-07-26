import type { SkPaint } from "@shopify/react-native-skia";

import type { SkiaApi } from "./artwork";

/**
 * 원본(`ticket-art.ts:150-159`):
 * ```
 * <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
 * <feColorMatrix values="0 0 0 0 0 ×3 / 0 0 0 6 -3"/>
 * <rect filter=… opacity="0.14|0.16"/>
 * ```
 * `stitchTiles="stitch"` 가 Skia `MakeFractalNoise` 의 tileW/tileH 인자에 대응한다.
 *
 * ⚠ paper 의 실기기 검증 이력은 Skia 2.0-next.4 / SDK 53 / Reanimated 3 기준이다.
 * 2.6.2 + RN 0.86 + New Architecture 조합에서는 **미검증** — 이 스파이크가 그 검증이다.
 * 실패 시 폴백은 그레인 PNG 타일 사전 래스터화.
 */
export function makeGrainPaint(
  skia: SkiaApi,
  {
    baseFrequency,
    octaves,
    opacity,
    tileWidth,
    tileHeight,
  }: {
    baseFrequency: number;
    octaves: number;
    opacity: number;
    tileWidth: number;
    tileHeight: number;
  },
): SkPaint {
  const paint = skia.Paint();
  paint.setShader(
    skia.Shader.MakeFractalNoise(baseFrequency, baseFrequency, octaves, 0, tileWidth, tileHeight),
  );

  // prettier-ignore
  const threshold = [
    0, 0, 0, 0,  0,
    0, 0, 0, 0,  0,
    0, 0, 0, 0,  0,
    0, 0, 0, 6, -3,
  ];
  // prettier-ignore
  const fade = [
    0, 0, 0, 0,       0,
    0, 0, 0, 0,       0,
    0, 0, 0, 0,       0,
    0, 0, 0, opacity, 0,
  ];

  // opacity 를 paint.setAlphaf 로 주면 셰이더 출력에 먼저 곱해져 임계 이후 클램프 순서가
  // SVG 와 달라진다. 임계 행렬(클램프 포함) 뒤에 별도 행렬로 곱해야 원본과 같다.
  paint.setColorFilter(
    skia.ColorFilter.MakeCompose(
      skia.ColorFilter.MakeMatrix(fade),
      skia.ColorFilter.MakeMatrix(threshold),
    ),
  );

  return paint;
}
