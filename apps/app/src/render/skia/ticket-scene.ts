import {
  BlendMode,
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  TextAlign,
  TileMode,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import type {
  Affine,
  HalftoneGlyphsPrimitive,
  PunchColumnPrimitive,
  SceneAlign,
  SceneFont,
  ScenePrimitive,
  TicketScene,
} from "@singsong/ticket-art";

import { makeGrainPaint } from "./grain";
import type { SkiaApi } from "./artwork";

const HALFTONE_SUPERSAMPLE = 10;

function applyBlendAndOpacity(
  paint: SkPaint,
  primitive: Pick<ScenePrimitive, "blend" | "opacity">,
) {
  if (primitive.blend === "multiply") paint.setBlendMode(BlendMode.Multiply);
  if (primitive.opacity !== undefined) paint.setAlphaf(primitive.opacity);
  return paint;
}

function colorPaint(
  skia: SkiaApi,
  color: string,
  primitive: Pick<ScenePrimitive, "blend" | "opacity">,
) {
  const paint = skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(skia.Color(color));
  return applyBlendAndOpacity(paint, primitive);
}

function affineMatrix([a, b, c, d, e, f]: Affine) {
  // SVG matrix(a b c d e f) -> Skia's row-major 3x3 matrix.
  return [a, c, e, b, d, f, 0, 0, 1];
}

function paragraphX(anchor: number, width: number, align: SceneAlign) {
  if (align === "center") return anchor - width / 2;
  if (align === "right") return anchor - width;
  return anchor;
}

function drawText(
  skia: SkiaApi,
  canvas: SkCanvas,
  {
    x,
    y,
    text,
    font,
    align,
  }: {
    x: number;
    y: number;
    text: string;
    font: SceneFont;
    align: SceneAlign;
  },
  foreground: SkPaint,
) {
  // ParagraphKit gives Korean shaping/fallback and applies the scene's exact
  // letter-spacing. Its top-left paint coordinate also matches TicketScene's
  // line-box-top contract.
  const builder = skia.ParagraphBuilder.Make({
    maxLines: 1,
    textAlign: TextAlign.Left,
    heightMultiplier: font.lineHeight / font.size,
  });
  builder.pushStyle(
    {
      color: foreground.getColor(),
      fontFamilies: [...font.family],
      fontSize: font.size,
      fontStyle: { weight: font.weight },
      heightMultiplier: font.lineHeight / font.size,
      halfLeading: true,
      letterSpacing: font.letterSpacing,
      locale: "ko-KR",
      ...(font.tabularNums ? { fontFeatures: [{ name: "tnum", value: 1 }] } : {}),
    },
    foreground,
  );
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(100_000);
  const textWidth = Math.max(1, Math.ceil(paragraph.getMaxIntrinsicWidth()));
  paragraph.layout(textWidth + 4);
  paragraph.paint(canvas, paragraphX(x, textWidth, align), y);
}

function makeHalftonePaint(skia: SkiaApi, primitive: HalftoneGlyphsPrimitive): SkPaint | null {
  const cellPixels = Math.max(1, Math.round(primitive.cell * HALFTONE_SUPERSAMPLE));
  const factor = cellPixels / primitive.cell;
  const surface = skia.Surface.Make(cellPixels, cellPixels);
  if (!surface) return null;

  const tileCanvas = surface.getCanvas();
  const background = skia.Paint();
  background.setColor(skia.Color("#000000"));
  tileCanvas.drawRect(skia.XYWHRect(0, 0, cellPixels, cellPixels), background);

  const center = cellPixels / 2;
  const dot = skia.Paint();
  dot.setAntiAlias(true);
  dot.setShader(
    skia.Shader.MakeRadialGradient(
      { x: center, y: center },
      primitive.dotRadius * factor,
      [skia.Color("#ffffff"), skia.Color("#ffffff"), skia.Color("#000000")],
      [0, primitive.dotCoreStop, 1],
      TileMode.Clamp,
    ),
  );
  tileCanvas.drawCircle(center, center, primitive.dotRadius * factor, dot);
  surface.flush();
  const tile = surface.makeImageSnapshot();

  const localMatrix = skia.Matrix();
  localMatrix.scale(primitive.cell / cellPixels, primitive.cell / cellPixels);
  const dots = tile.makeShaderOptions(
    TileMode.Repeat,
    TileMode.Repeat,
    FilterMode.Linear,
    MipmapMode.None,
    localMatrix,
  );
  const tone = skia.Shader.MakeLinearGradient(
    { x: 0, y: primitive.rampTop },
    { x: 0, y: primitive.rampTop + primitive.tileSize },
    primitive.toneStops.map(([, css]) => skia.Color(css)),
    primitive.toneStops.map(([offset]) => offset),
    TileMode.Clamp,
  );

  const paint = skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(skia.Shader.MakeBlend(BlendMode.Multiply, tone, dots));
  const gain = primitive.thresholdGain;
  const bias = primitive.thresholdBias;
  paint.setColorFilter(
    skia.ColorFilter.MakeCompose(
      skia.ColorFilter.MakeBlend(skia.Color(primitive.inkColor), BlendMode.SrcIn),
      skia.ColorFilter.MakeMatrix([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        gain,
        gain,
        gain,
        0,
        bias,
      ]),
    ),
  );
  return applyBlendAndOpacity(paint, primitive);
}

function clearColor(color: Float32Array) {
  const transparent = Float32Array.from(color);
  transparent[3] = 0;
  return transparent;
}

function drawPunchColumn(skia: SkiaApi, canvas: SkCanvas, primitive: PunchColumnPrimitive) {
  const hole = skia.Color(primitive.color);
  const clear = clearColor(hole);
  const saveCount = canvas.save();
  canvas.clipRect(
    skia.XYWHRect(primitive.x, primitive.top, primitive.width, primitive.height),
    ClipOp.Intersect,
    true,
  );
  const steps = Math.ceil(primitive.height / 2 / primitive.pitch) + 1;
  for (let index = -steps; index <= steps; index += 1) {
    const centerY = primitive.centerY + index * primitive.pitch;
    const paint = skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      skia.Shader.MakeRadialGradient(
        { x: primitive.x + primitive.width / 2, y: centerY },
        primitive.radius,
        [hole, hole, clear, clear],
        [0, primitive.innerStop, primitive.outerStop, 1],
        TileMode.Clamp,
      ),
    );
    applyBlendAndOpacity(paint, primitive);
    canvas.drawRect(
      skia.XYWHRect(primitive.x, centerY - primitive.pitch / 2, primitive.width, primitive.pitch),
      paint,
    );
  }
  canvas.restoreToCount(saveCount);
}

function drawPrimitive(skia: SkiaApi, canvas: SkCanvas, primitive: ScenePrimitive) {
  switch (primitive.kind) {
    case "rrect": {
      const rect = skia.RRectXY(
        skia.XYWHRect(primitive.x, primitive.y, primitive.width, primitive.height),
        primitive.radius,
        primitive.radius,
      );
      if (primitive.fill) {
        canvas.drawRRect(rect, colorPaint(skia, primitive.fill, primitive));
      }
      if (primitive.stroke && primitive.strokeWidth) {
        const stroke = colorPaint(skia, primitive.stroke, primitive);
        stroke.setStyle(PaintStyle.Stroke);
        stroke.setStrokeWidth(primitive.strokeWidth);
        canvas.drawRRect(rect, stroke);
      }
      return;
    }
    case "path": {
      const path = skia.Path.MakeFromSVGString(primitive.d);
      if (!path) return;
      path.transform(affineMatrix(primitive.transform));
      canvas.drawPath(path, colorPaint(skia, primitive.fill, primitive));
      return;
    }
    case "circle":
      canvas.drawCircle(
        primitive.cx,
        primitive.cy,
        primitive.r,
        colorPaint(skia, primitive.fill, primitive),
      );
      return;
    case "rect": {
      const saveCount = canvas.save();
      if (primitive.transform) canvas.concat(affineMatrix(primitive.transform));
      canvas.drawRect(
        skia.XYWHRect(primitive.x, primitive.y, primitive.width, primitive.height),
        colorPaint(skia, primitive.fill, primitive),
      );
      canvas.restoreToCount(saveCount);
      return;
    }
    case "dashLine": {
      const paint = colorPaint(skia, primitive.stroke, primitive);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(primitive.strokeWidth);
      paint.setPathEffect(skia.PathEffect.MakeDash([...primitive.dash], 0));
      canvas.drawLine(primitive.x1, primitive.y1, primitive.x2, primitive.y2, paint);
      return;
    }
    case "punchColumn":
      drawPunchColumn(skia, canvas, primitive);
      return;
    case "barcodeBars": {
      const saveCount = canvas.save();
      canvas.clipRect(
        skia.XYWHRect(primitive.x, primitive.y, primitive.width, primitive.height),
        ClipOp.Intersect,
        false,
      );
      const paint = colorPaint(skia, primitive.color, primitive);
      for (let periodX = 0; periodX < primitive.width; periodX += primitive.period) {
        for (const bar of primitive.bars) {
          canvas.drawRect(
            skia.XYWHRect(
              primitive.x + periodX + bar.offset,
              primitive.y,
              bar.width,
              primitive.height,
            ),
            paint,
          );
        }
      }
      canvas.restoreToCount(saveCount);
      return;
    }
    case "text":
      drawText(skia, canvas, primitive, colorPaint(skia, primitive.color, primitive));
      return;
    case "ghostText":
      drawText(
        skia,
        canvas,
        { ...primitive, x: primitive.x + primitive.dx, y: primitive.y + primitive.dy },
        colorPaint(skia, primitive.color, primitive),
      );
      return;
    case "halftoneGlyphs": {
      const paint = makeHalftonePaint(skia, primitive);
      if (paint) drawText(skia, canvas, primitive, paint);
      return;
    }
    case "grain": {
      const paint = makeGrainPaint(skia, {
        baseFrequency: primitive.baseFrequency,
        octaves: primitive.octaves,
        opacity: primitive.opacity ?? 1,
        tileWidth: primitive.tileWidth,
        tileHeight: primitive.tileHeight,
      });
      if (primitive.blend === "multiply") paint.setBlendMode(BlendMode.Multiply);
      canvas.drawRect(
        skia.XYWHRect(primitive.x, primitive.y, primitive.width, primitive.height),
        paint,
      );
      return;
    }
    case "qrModules": {
      const paint = colorPaint(skia, primitive.color, primitive);
      primitive.modules.forEach((row, rowIndex) => {
        row.forEach((filled, columnIndex) => {
          if (!filled) return;
          canvas.drawRect(
            skia.XYWHRect(
              primitive.x + (columnIndex + primitive.quietZoneModules) * primitive.moduleSize,
              primitive.y + (rowIndex + primitive.quietZoneModules) * primitive.moduleSize,
              primitive.moduleSize,
              primitive.moduleSize,
            ),
            paint,
          );
        });
      });
      return;
    }
    default: {
      const exhaustive: never = primitive;
      return exhaustive;
    }
  }
}

/** Executes the repository-owned TicketScene display list on a Skia canvas. */
export function drawTicketScene(skia: SkiaApi, canvas: SkCanvas, scene: TicketScene) {
  const saveCount = canvas.save();
  canvas.clipRRect(
    skia.RRectXY(
      skia.XYWHRect(scene.clip.x, scene.clip.y, scene.clip.width, scene.clip.height),
      scene.clip.radius,
      scene.clip.radius,
    ),
    ClipOp.Intersect,
    true,
  );
  for (const primitive of scene.primitives) drawPrimitive(skia, canvas, primitive);
  canvas.restoreToCount(saveCount);
}

export function recordTicketScene(skia: SkiaApi, scene: TicketScene): SkPicture {
  const recorder = skia.PictureRecorder();
  const canvas = recorder.beginRecording(skia.XYWHRect(0, 0, scene.width, scene.height));
  drawTicketScene(skia, canvas, scene);
  return recorder.finishRecordingAsPicture();
}

export function rasterizeTicketScene(skia: SkiaApi, scene: TicketScene) {
  const surface = skia.Surface.Make(Math.round(scene.width), Math.round(scene.height));
  if (!surface) {
    throw new Error("Skia CPU Surface를 만들 수 없어 티켓 PNG를 생성하지 못했어요.");
  }
  drawTicketScene(skia, surface.getCanvas(), scene);
  surface.flush();
  return surface.makeImageSnapshot();
}
