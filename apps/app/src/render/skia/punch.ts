import { ClipOp, TileMode, type SkCanvas, type SkColor } from "@shopify/react-native-skia";

import { ARTWORK, type SkiaApi } from "./artwork";

/**
 * 원본은 CSS 다(`ticket-art.ts:269-282`):
 * ```
 * background-image: radial-gradient(circle, hole 42%, transparent 46%)
 * background-size: 8px 18.4px;  background-repeat: repeat-y;  background-position: center
 * width: 8px;  top: 72px;  bottom: 88px;  {side}: 7.2px
 * ```
 *
 * CSS `circle` 의 기본 크기는 `farthest-corner` — 8×18.4 상자 중심에서 모서리까지
 * `hypot(4, 9.2) = 10.032`. 그래서 42% = 4.213px 인데 열 폭 반값이 4px 이라
 * **원의 좌우가 평평하게 잘린다.** 이 잘림이 원본 인상의 일부라 열 폭으로 클립해서 재현한다.
 * 구멍 사이 보이는 간격은 9.17px.
 */
export function punchGeometry() {
  const { dotPx, pitchPx, insetPx, topPx, bottomPx, innerStop, outerStop } = ARTWORK.punch;
  return {
    dotPx,
    pitchPx,
    insetPx,
    topPx,
    bottomPx,
    // farthest-corner: 상자 중심에서 가장 먼 모서리까지.
    radius: Math.hypot(dotPx / 2, pitchPx / 2),
    innerStop: innerStop / 100,
    outerStop: outerStop / 100,
  };
}

/** RGB 는 그대로 두고 알파만 0 으로 — CSS `transparent` 의 프리멀티플라이 보간과 같은 결과. */
function toClear(base: SkColor): SkColor {
  const clear = Float32Array.from(base);
  clear[3] = 0;
  return clear;
}

export function drawPunchColumn(
  skia: SkiaApi,
  canvas: SkCanvas,
  { x, top, height, holeColor }: { x: number; top: number; height: number; holeColor: SkColor },
) {
  const { dotPx, pitchPx, radius, innerStop, outerStop } = punchGeometry();
  const clear = toClear(holeColor);

  canvas.save();
  canvas.clipRect(skia.XYWHRect(x, top, dotPx, height), ClipOp.Intersect, true);

  // `background-position: center` 는 타일 하나의 중심을 열 중심에 맞춘 뒤 양쪽으로 반복한다.
  const centerY = top + height / 2;
  const stepsUp = Math.ceil(height / 2 / pitchPx) + 1;

  for (let k = -stepsUp; k <= stepsUp; k += 1) {
    const cy = centerY + k * pitchPx;
    const paint = skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      skia.Shader.MakeRadialGradient(
        { x: x + dotPx / 2, y: cy },
        radius,
        [holeColor, holeColor, clear, clear],
        [0, innerStop, outerStop, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(skia.XYWHRect(x, cy - pitchPx / 2, dotPx, pitchPx), paint);
  }

  canvas.restore();
}
