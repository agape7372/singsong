import {
  BlendMode,
  FilterMode,
  MipmapMode,
  TileMode,
  type SkImage,
  type SkPaint,
  type SkShader,
} from "@shopify/react-native-skia";

import { ARTWORK, color, scaleToTile, type SkiaApi } from "./artwork";

/**
 * 원본(`ticket-art.ts:219-264`)의 SVG 체인을 Skia 로 옮긴 것.
 *
 * ```
 * <pattern>  검정 셀 + 흰 중심 방사 그라디언트 원      → dotTile 이미지 + Repeat 셰이더
 * <linearGradient> 세로 톤 램프                        → MakeLinearGradient
 * mix-blend-mode:multiply                              → Shader.MakeBlend(Multiply)
 * feColorMatrix "0 0 0 0 0 ×3 / 14 14 14 0 -8.4"       → ColorFilter.MakeMatrix
 * feFlood(paper) + feComposite operator="in"           → ColorFilter.MakeBlend(paper, SrcIn)
 * ```
 *
 * 그려지는 결과: 위쪽은 구멍 없는 솔리드, 아래로 갈수록 종이색 망점이 커진다.
 * 망점 자체가 종이색이므로 **악센트로 칠한 글자 위에 겹쳐 찍어야** 원본과 같은 인상이 된다.
 *
 * 모든 빌더는 `skia` 를 첫 인자로 받는다(`SqlExecutor` 와 같은 이음매). 앱은 `./index` 가
 * 실제 `Skia` 를 묶어 주고, 헤드리스 검증은 CanvasKit `JsiSkApi` 를 넣어 같은 코드를 돌린다.
 */

/** 2.6dp 셀을 그대로 래스터화하면 점이 뭉개진다. 10배로 떠서 셰이더에서 줄인다. */
const SUPERSAMPLE = 10;

type ToneStop = [number, string];

function toneStops(): ToneStop[] {
  return ARTWORK.halftone.toneStops as ToneStop[];
}

/** 셀 한 칸을 10배 크기로 오프스크린 래스터화한다. 화면당 1회만 만들면 된다. */
export function makeDotTile(skia: SkiaApi, sizePx: number): SkImage | null {
  const cell = scaleToTile(ARTWORK.halftone.cellPx, sizePx);
  const dotRadius = scaleToTile(ARTWORK.halftone.dotRadiusPx, sizePx);
  const px = Math.max(1, Math.round(cell * SUPERSAMPLE));
  // 반올림된 px 로부터 실제 배율을 되짚어야 점 지름이 셀 대비 92.3% 로 유지된다.
  const factor = px / cell;

  const surface = skia.Surface.Make(px, px);
  if (!surface) return null;
  const canvas = surface.getCanvas();

  const background = skia.Paint();
  background.setColor(skia.Color("#000000"));
  canvas.drawRect(skia.XYWHRect(0, 0, px, px), background);

  const center = px / 2;
  const radius = dotRadius * factor;
  const dot = skia.Paint();
  dot.setAntiAlias(true);
  dot.setShader(
    skia.Shader.MakeRadialGradient(
      { x: center, y: center },
      radius,
      [skia.Color("#ffffff"), skia.Color("#ffffff"), skia.Color("#000000")],
      [0, ARTWORK.halftone.dotCoreStop, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(center, center, radius, dot);

  return surface.makeImageSnapshot();
}

/**
 * @param sizePx  글자 크기(=타일 한 변). 톤 램프가 이 높이에 걸쳐 한 번 흐른다.
 * @param top     램프 시작 y. 글자 em 박스 상단에 맞춘다.
 */
export function makeHalftoneShader(
  skia: SkiaApi,
  tile: SkImage,
  sizePx: number,
  top: number,
): SkShader {
  const cell = scaleToTile(ARTWORK.halftone.cellPx, sizePx);
  const px = Math.max(1, Math.round(cell * SUPERSAMPLE));

  const localMatrix = skia.Matrix();
  localMatrix.scale(cell / px, cell / px);

  const dots = tile.makeShaderOptions(
    // Clamp(0) 를 쓰면 타일 바깥이 전부 검게 나와 망점이 사라진다. 반드시 Repeat.
    TileMode.Repeat,
    TileMode.Repeat,
    FilterMode.Linear,
    MipmapMode.None,
    localMatrix,
  );

  const stops = toneStops();
  const tone = skia.Shader.MakeLinearGradient(
    { x: 0, y: top },
    { x: 0, y: top + sizePx },
    stops.map(([, css]) => skia.Color(css)),
    stops.map(([offset]) => offset),
    TileMode.Clamp,
  );

  return skia.Shader.MakeBlend(BlendMode.Multiply, tone, dots);
}

/** feColorMatrix 와 같은 20개 값. RGB 는 0 으로 죽이고 알파만 휘도에서 만든다. */
export function thresholdMatrix(): number[] {
  const { thresholdGain: g, thresholdBias: b } = ARTWORK.halftone;
  // prettier-ignore
  return [
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    g, g, g, 0, b,
  ];
}

export function makeHalftonePaint(
  skia: SkiaApi,
  tile: SkImage,
  sizePx: number,
  top: number,
): SkPaint {
  const paint = skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(makeHalftoneShader(skia, tile, sizePx, top));
  paint.setColorFilter(
    // Compose(outer, inner) = inner 먼저. 임계로 알파를 만든 뒤 종이색을 SrcIn 으로 채운다.
    skia.ColorFilter.MakeCompose(
      skia.ColorFilter.MakeBlend(color(skia, "paper"), BlendMode.SrcIn),
      skia.ColorFilter.MakeMatrix(thresholdMatrix()),
    ),
  );
  return paint;
}
