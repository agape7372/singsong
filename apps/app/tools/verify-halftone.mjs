#!/usr/bin/env node
/**
 * 하프톤/그레인/펀치 Skia 포팅 헤드리스 검증 하네스.
 *
 *   cd apps/app && node tools/verify-halftone.mjs
 *
 * EAS 클라우드 빌드를 태우기 전에, 새로 쓴 Skia 코드가 원본 SVG 구현
 * (`src/features/ticket/ticket-art.ts`)과 **수학적으로 같은 그림**을 그리는지 증명한다.
 *
 * 재구현이 아니라 **프로덕션 코드를 그대로 실행한다.** CanvasKit 을 헤드리스로 띄우고
 * RN Skia 의 `JsiSkApi(CanvasKit)` 로 `Skia` 와 동일한 표면을 만든 뒤,
 * `src/render/skia/*` 의 순수 빌더에 그대로 주입한다.
 *
 * 결과 PNG 는 `tools/out/` 에 떨어진다(gitignore).
 */

import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire, register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ────────────────────────────── 0. Node 로더 준비 ────────────────────────────── */

// 앱 소스(`.ts`)를 **번들러 없이** Node 에서 그대로 읽기 위한 최소 보정 3가지.
//   1. `@shopify/react-native-skia` → RN 없이 열거형만 들어 있는 순수 모듈로 치환.
//      (렌더 모듈은 DI 리팩터 이후 값으로는 열거형만 import 한다. 실제 `Skia` 를 값으로
//       가져오는 곳은 `src/render/skia/index.ts` 하나뿐이고, 하네스는 그 파일을 안 쓴다.)
//   2. 확장자 없는 상대 경로 — 번들러 관례를 Node 해석기에 맞춘다.
//   3. `.ts` 는 명시적으로 타입 스트리핑, `.json` 은 import attribute 없이 통과.
const HOOKS = `
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name === "ExperimentalWarning") return;
  console.warn(w.name + ": " + w.message);
});
const TYPES = "@shopify/react-native-skia/lib/commonjs/skia/types/index.js";
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
export async function resolve(spec, ctx, next) {
  if (spec === "@shopify/react-native-skia") return next(TYPES, ctx);
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("file:")) {
    let last;
    for (const ext of CANDIDATES) {
      try { return await next(spec + ext, ctx); } catch (e) { last = e; }
    }
    throw last;
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith("file:") && url.endsWith(".json")) {
    const src = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: "export default " + src + ";", shortCircuit: true };
  }
  if (url.startsWith("file:") && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
    const src = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: stripTypeScriptTypes(src, { mode: "strip", sourceUrl: url }),
      shortCircuit: true,
    };
  }
  return next(url, ctx);
}
`;
register("data:text/javascript," + encodeURIComponent(HOOKS));

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const REPO = join(APP, "..", "..");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const src = (p) => pathToFileURL(join(APP, "src", p)).href;

/* ────────────────────────────── 1. CanvasKit 부팅 ────────────────────────────── */

const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js");
await LoadSkiaWeb();
const { JsiSkApi } = await import("@shopify/react-native-skia/lib/commonjs/skia/web/index.js");
/** RN 의 `Skia` 와 같은 표면. 렌더 모듈은 이걸 받아 프로덕션과 같은 경로를 탄다. */
const skia = JsiSkApi(globalThis.CanvasKit);

const { AlphaType, ColorType } =
  await import("@shopify/react-native-skia/lib/commonjs/skia/types/index.js");

/* ────────────────── 2. 검증 대상 = 프로덕션 렌더 모듈 (재구현 아님) ────────────────── */

const { ARTWORK, color, hex, scaleToTile } = await import(src("render/skia/artwork.ts"));
const { makeDotTile, makeHalftonePaint, thresholdMatrix } = await import(
  src("render/skia/halftone.ts")
);
const { makeGrainPaint } = await import(src("render/skia/grain.ts"));
const { drawPunchColumn, punchGeometry } = await import(src("render/skia/punch.ts"));

/* ────────────────────────────── 3. 렌더 헬퍼 ────────────────────────────── */

/** `spike-canvas.tsx` 의 `<Canvas>` 한 장에 해당. dp 좌표계로 그리고 scale 배로 뜬다. */
function render({ name, wDp, hDp, scale = 1, draw, write = true }) {
  const w = Math.round(wDp * scale);
  const h = Math.round(hDp * scale);
  const surface = skia.Surface.Make(w, h);
  if (!surface) throw new Error(`Skia.Surface.Make(${w}, ${h}) 가 null 을 반환했다`);
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  draw(canvas);
  const image = surface.makeImageSnapshot();
  if (write) writeFileSync(join(OUT, `${name}.png`), Buffer.from(image.encodeToBytes()));
  const pixels = image.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  return { name, w, h, scale, px: new Uint8Array(pixels) };
}

function fillRect(canvas, x, y, w, h, css) {
  const paint = skia.Paint();
  paint.setColor(skia.Color(css));
  canvas.drawRect(skia.XYWHRect(x, y, w, h), paint);
}

/* ────────────────────────────── 4. 장면 (spike-canvas.tsx 그대로) ────────────────────────────── */

const ART_W = 320;
const RAMP_PX = ARTWORK.halftone.fontSizePx; // 150

const tile = makeDotTile(skia, RAMP_PX);
if (!tile) throw new Error("makeDotTile 이 null — 도트 타일 실패");

/** `RampScene` 과 동일: 악센트 사각형 위에 하프톤 페인트를 겹쳐 찍는다. */
const drawRamp = (canvas) => {
  fillRect(canvas, 0, 0, ART_W, RAMP_PX, hex("accent"));
  canvas.drawRect(skia.XYWHRect(0, 0, ART_W, RAMP_PX), makeHalftonePaint(skia, tile, RAMP_PX, 0));
};

const ramp = render({ name: "ramp", wDp: ART_W, hDp: RAMP_PX, draw: drawRamp });

// 서브픽셀 계측 전용. 1dp = 8px 이라 점 지름·피치를 0.125dp 해상도로 잰다.
// (실기기 유효 배율은 ~3.7x — 320dp 폭 캔버스를 393dp 화면 DPR3 에 그릴 때.)
const rampX8 = render({ name: "ramp-x8", wDp: ART_W, hDp: RAMP_PX, scale: 8, draw: drawRamp });

// 그레인 두 장 (`GrainScene` 의 좌/우 패치와 같은 타일 크기 160×130).
const GRAIN_W = 160;
const GRAIN_H = 130;
for (const [file, spec] of [
  ["grain-014", ARTWORK.composition.grain],
  ["grain-016", ARTWORK.cardGrain],
]) {
  render({
    name: file,
    wDp: GRAIN_W,
    hDp: GRAIN_H,
    draw: (canvas) => {
      fillRect(canvas, 0, 0, GRAIN_W, GRAIN_H, hex("paper"));
      canvas.drawRect(
        skia.XYWHRect(0, 0, GRAIN_W, GRAIN_H),
        makeGrainPaint(skia, {
          baseFrequency: spec.baseFrequency,
          octaves: spec.octaves,
          opacity: spec.opacity,
          tileWidth: GRAIN_W,
          tileHeight: GRAIN_H,
        }),
      );
    },
  });
}

// 펀치 (`PunchScene`, 라이트 스킴).
const PUNCH_H = 260;
const punch = render({
  name: "punch",
  wDp: ART_W,
  hDp: PUNCH_H,
  draw: (canvas) => {
    const paper = skia.Paint();
    paper.setAntiAlias(true);
    paper.setColor(color(skia, "paper"));
    canvas.drawRRect(
      skia.RRectXY(skia.XYWHRect(0, 0, ART_W, PUNCH_H), ARTWORK.radiusPx, ARTWORK.radiusPx),
      paper,
    );
    const { insetPx, topPx, dotPx, bottomPx } = ARTWORK.punch;
    const hole = color(skia, "hole");
    const height = PUNCH_H - topPx - bottomPx;
    drawPunchColumn(skia, canvas, { x: insetPx, top: topPx, height, holeColor: hole });
    drawPunchColumn(skia, canvas, {
      x: ART_W - insetPx - dotPx,
      top: topPx,
      height,
      holeColor: hole,
    });
  },
});

/* ────────────────────────────── 5. 기대값 산술 (JSON 상수에서 유도) ────────────────────────────── */

const H = ARTWORK.halftone;
const GAIN = H.thresholdGain;
const BIAS = H.thresholdBias;
const CELL = scaleToTile(H.cellPx, RAMP_PX);
const DOT_R = scaleToTile(H.dotRadiusPx, RAMP_PX);
const CORE = H.dotCoreStop;

// feColorMatrix 알파 행: A' = gain*(R+G+B) + bias. 회색 v 에 대해 A' = 3*gain*v + bias.
/** A' = 0 이 되는 톤 값 (임계 시작). */
const V_CUT = -BIAS / (3 * GAIN);
/** A' = 1 이 되는 톤 값 (완전 불투명 = 진짜 종이색). */
const V_FULL = (1 - BIAS) / (3 * GAIN);

const lumOf = (css) => parseInt(css.slice(1, 3), 16) / 255; // 톤 스톱은 전부 무채색
const stops = H.toneStops.map(([o, css]) => [o, lumOf(css)]);

/** 조각선형 톤 램프가 값 v 를 처음 넘는 오프셋. */
function offsetAtTone(v) {
  for (let i = 1; i < stops.length; i += 1) {
    const [o0, v0] = stops[i - 1];
    const [o1, v1] = stops[i];
    if (v >= v0 && v <= v1) return o0 + ((v - v0) / (v1 - v0)) * (o1 - o0);
  }
  return NaN;
}

const CUT_OFFSET = offsetAtTone(V_CUT);
const FULL_OFFSET = offsetAtTone(V_FULL);
const CUT_Y = CUT_OFFSET * RAMP_PX;
const FULL_Y = FULL_OFFSET * RAMP_PX;

/** 바닥 톤에서 임계를 넘는 도트 반경. 방사 그라디언트는 core 까지 1, 그 뒤 선형 하강. */
const V_BOTTOM = stops[stops.length - 1][1];
const DOT_CUT = V_CUT / V_BOTTOM; // 이 값 이상이어야 임계 통과
const MAX_R = DOT_R * (CORE + (1 - DOT_CUT) * (1 - CORE));
const MAX_D = 2 * MAX_R;

/* ────────────────────────────── 6. 픽셀 분석 도구 ────────────────────────────── */

const ACCENT = hexRgb(hex("accent"));
const PAPER = hexRgb(hex("paper"));
function hexRgb(css) {
  return [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16));
}

function makeProbe(buf) {
  const at = (x, y) => {
    const i = (y * buf.w + x) * 4;
    return [buf.px[i], buf.px[i + 1], buf.px[i + 2], buf.px[i + 3]];
  };
  const near = (p, ref, tol) =>
    Math.abs(p[0] - ref[0]) <= tol &&
    Math.abs(p[1] - ref[1]) <= tol &&
    Math.abs(p[2] - ref[2]) <= tol;
  return {
    at,
    isPaper: (x, y) => near(at(x, y), PAPER, 2),
    isAccent: (x, y) => near(at(x, y), ACCENT, 2),
    delta: (x, y, ref) => {
      const p = at(x, y);
      return Math.max(...ref.map((c, i) => Math.abs(p[i] - c)));
    },
  };
}

/** 한 행의 종이색 런(연속 구간) 목록. */
function paperRuns(buf, y) {
  const probe = makeProbe(buf);
  const runs = [];
  let start = -1;
  for (let x = 0; x < buf.w; x += 1) {
    if (probe.isPaper(x, y)) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      runs.push({ start, end: x, len: x - start, center: (start + x) / 2 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: buf.w, len: buf.w - start, center: (start + buf.w) / 2 });
  return runs;
}

function paperFractionByRow(buf) {
  const probe = makeProbe(buf);
  const out = new Float64Array(buf.h);
  for (let y = 0; y < buf.h; y += 1) {
    let n = 0;
    for (let x = 0; x < buf.w; x += 1) if (probe.isPaper(x, y)) n += 1;
    out[y] = n / buf.w;
  }
  return out;
}

/** 바닥에서 가장 위쪽 셀 안에서 종이 픽셀이 가장 많은 행 = 도트 중심이 얹힌 행. */
function bottomDotRow(buf, cellPx) {
  const span = Math.ceil(cellPx) + 1;
  const probe = makeProbe(buf);
  let best = buf.h - 1;
  let bestN = -1;
  for (let y = buf.h - span; y < buf.h; y += 1) {
    let n = 0;
    for (let x = 0; x < buf.w; x += 1) if (probe.isPaper(x, y)) n += 1;
    if (n > bestN) {
      bestN = n;
      best = y;
    }
  }
  return best;
}

/**
 * 한 행의 종이 마스크가 반복되는 최소 주기(px).
 *
 * 1× 에서는 셀 2.6px 의 틈(0.475px)이 픽셀 중심 사이로 빠져 인접 점이 붙어 보인다.
 * 그래서 런 중심 간격으로는 피치를 못 잰다. 대신 **패턴의 반복 주기**를 재고
 * 그 안에 든 셀 개수로 나눈다 — 2.6px 셀이면 5셀 = 13px 이 정확히 정수라 주기가 13 이다.
 */
function maskPeriod(buf, y, maxLag) {
  const probe = makeProbe(buf);
  const mask = Array.from({ length: buf.w }, (_, x) => probe.isPaper(x, y));
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let same = 0;
    const n = buf.w - lag;
    for (let x = 0; x < n; x += 1) if (mask[x] === mask[x + lag]) same += 1;
    if (same === n) return lag;
  }
  return NaN;
}

/* ────────────────────────────── 7. 어서션 러너 ────────────────────────────── */

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (detail) for (const line of [].concat(detail)) console.log(`        ${line}`);
};
const info = (line) => console.log(`        ${line}`);
const head = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`);

console.log("싱송 하프톤 Skia 포팅 검증 — CanvasKit " + "headless / JsiSkApi");
console.log(`출력: ${OUT}`);

head("상수에서 유도한 기대값");
info(`셀 = ${H.cellPx} × (${RAMP_PX}/${H.fontSizePx}) = ${CELL} px`);
info(`도트 반지름 = ${H.dotRadiusPx} × (${RAMP_PX}/${H.fontSizePx}) = ${DOT_R} px  (코어 ${CORE})`);
info(
  `임계 A' = ${GAIN}(R+G+B) ${BIAS} = ${3 * GAIN}·v ${BIAS}` +
    `  →  A'=0 at v=${V_CUT.toFixed(6)}, A'=1 at v=${V_FULL.toFixed(6)}`,
);
info(`톤 스톱 휘도: ` + stops.map(([o, v]) => `[${o} → ${v.toFixed(6)}]`).join(" "));
info(
  `v=${V_CUT.toFixed(4)} 교차: ${stops[1][0]} + ((${V_CUT.toFixed(6)}−${stops[1][1].toFixed(6)})/` +
    `(${stops[2][1].toFixed(6)}−${stops[1][1].toFixed(6)}))×(${stops[2][0]}−${stops[1][0]})` +
    ` = ${CUT_OFFSET.toFixed(6)}`,
);
info(`  → 첫 구멍(부분 알파) y = ${CUT_OFFSET.toFixed(4)} × ${RAMP_PX} = ${CUT_Y.toFixed(3)} px`);
info(
  `  → 완전 종이색 y = ${FULL_OFFSET.toFixed(6)} × ${RAMP_PX} = ${FULL_Y.toFixed(3)} px` +
    ` (A'=1 이 되어야 ±2 안에 든다)`,
);
info(
  `바닥 톤 v=${V_BOTTOM.toFixed(6)} → 도트 임계 ${DOT_CUT.toFixed(4)}` +
    ` → 최대 반경 ${DOT_R}×(${CORE}+${(1 - DOT_CUT).toFixed(4)}×${(1 - CORE).toFixed(2)})` +
    ` = ${MAX_R.toFixed(4)} px`,
);
info(
  `  → 최대 지름 ${MAX_D.toFixed(4)} px = 셀의 ${((MAX_D / CELL) * 100).toFixed(1)}%` +
    `  (설계 목표 0.885·r = ${(0.885 * DOT_R).toFixed(4)}, 81.7%)`,
);
info(
  `바닥 종이 면적비 기대 = π·${MAX_R.toFixed(4)}² / ${CELL}² = ${((Math.PI * MAX_R ** 2) / CELL ** 2).toFixed(4)}`,
);

/* ── 어서션 1: 위쪽은 솔리드 악센트 ── */
head("1. 램프 상단은 구멍 없는 솔리드 악센트");
const probe = makeProbe(ramp);
let firstNonAccentRow = -1;
let firstPaperRow = -1;
for (let y = 0; y < ramp.h && (firstNonAccentRow < 0 || firstPaperRow < 0); y += 1) {
  for (let x = 0; x < ramp.w; x += 1) {
    if (firstNonAccentRow < 0 && !probe.isAccent(x, y)) firstNonAccentRow = y;
    if (firstPaperRow < 0 && probe.isPaper(x, y)) firstPaperRow = y;
  }
}
const AA_MARGIN = 1; // 안티에일리어스/타일 보간 여유 1행
check(
  firstNonAccentRow >= Math.floor(CUT_Y) - AA_MARGIN,
  `교차선 위 ${Math.floor(CUT_Y)}행에 악센트 아닌 픽셀이 없다`,
  [
    `기대: 첫 비-악센트 행 ≥ ${Math.floor(CUT_Y) - AA_MARGIN} (교차 ${CUT_Y.toFixed(3)}, 여유 ${AA_MARGIN})`,
    `실측: 첫 비-악센트 행 = ${firstNonAccentRow}  (Δ ${(firstNonAccentRow - CUT_Y).toFixed(3)} px)`,
    `      0..${firstNonAccentRow - 1} 행 ${ramp.w * firstNonAccentRow} px 전부 #ff3d6e ±2`,
  ],
);
check(
  firstPaperRow >= Math.floor(CUT_Y) - AA_MARGIN,
  `교차선 위에 종이색(#f6efdc) 픽셀이 하나도 없다`,
  [
    `실측: 첫 종이색 행 = ${firstPaperRow}  (완전 알파 예측 ${FULL_Y.toFixed(3)}, Δ ${(firstPaperRow - FULL_Y).toFixed(3)} px)`,
  ],
);
check(
  Math.abs(firstPaperRow - FULL_Y) <= CELL + AA_MARGIN,
  `첫 종이색 행이 A'=1 예측선 ±(셀+1)px 안에 있다`,
  [`허용 ±${(CELL + AA_MARGIN).toFixed(2)} px · 실측 Δ ${(firstPaperRow - FULL_Y).toFixed(3)} px`],
);

/* ── 어서션 2: 아래로 갈수록 종이 비율 증가 ── */
head("2. 교차선 아래로 종이 비율이 단조 증가");
const frac = paperFractionByRow(ramp);
const paperBelow = frac.slice(Math.ceil(CUT_Y)).reduce((a, b) => a + b, 0);
check(paperBelow > 0, "교차선 아래에 종이색 망점이 실재한다", [
  `종이 비율 합(교차선 아래 ${ramp.h - Math.ceil(CUT_Y)}행) = ${paperBelow.toFixed(3)}`,
  `바닥 행 종이 비율 = ${frac[ramp.h - 1].toFixed(4)} · 최대 행 = ${Math.max(...frac).toFixed(4)}`,
]);

// 행별 비율은 셀 주기(2.6행)로 진동한다. 5셀 = 13행이 정확히 정수라 13행 이동평균으로 상쇄한다.
let win = 1;
for (let k = 1; k <= 20; k += 1) {
  if (Math.abs(CELL * k - Math.round(CELL * k)) < 1e-9) {
    win = Math.round(CELL * k);
    break;
  }
}
const smooth = [];
for (let y = Math.ceil(CUT_Y); y + win <= ramp.h; y += 1) {
  let s = 0;
  for (let k = 0; k < win; k += 1) s += frac[y + k];
  smooth.push(s / win);
}
const TOL = 0.01;
let violations = 0;
let worst = 0;
for (let i = 1; i < smooth.length; i += 1) {
  const d = smooth[i - 1] - smooth[i];
  if (d > TOL) violations += 1;
  worst = Math.max(worst, d);
}
check(violations === 0, `${win}행 이동평균이 단조 비감소 (허용 노이즈 ${TOL})`, [
  `창 = ${win}행 (= ${win / CELL} 셀, 정수 주기라 진동이 정확히 상쇄된다)`,
  `표본 ${smooth.length}개 · 위반 ${violations}회 · 최대 역행 ${worst.toFixed(5)}`,
  `시작 ${smooth[0].toFixed(4)} → 끝 ${smooth[smooth.length - 1].toFixed(4)}`,
]);
check(smooth[smooth.length - 1] > smooth[0], "전체 추세가 증가 (끝 > 시작)", [
  `증가폭 ${(smooth[smooth.length - 1] - smooth[0]).toFixed(4)}`,
]);

/* ── 어서션 3: 도트 피치 ── */
head("3. 도트 피치 = 셀 크기");
const row1x = bottomDotRow(ramp, CELL);
const rowX8 = bottomDotRow(rampX8, CELL * 8);
const runsX8 = paperRuns(rampX8, rowX8);
const pitchX8 =
  runsX8.length > 1
    ? (runsX8[runsX8.length - 1].center - runsX8[0].center) / (runsX8.length - 1) / 8
    : NaN;

// 1× 는 런 중심으로 못 잰다(아래 4번 참고). 마스크의 반복 주기 → 셀 개수로 나눈다.
const period1x = maskPeriod(ramp, row1x, 40);
const cellsInPeriod = Math.round(period1x / CELL);
const pitch1x = period1x / cellsInPeriod;
const EXPECT_DOTS = Math.floor(ART_W / CELL) + ((ART_W / CELL) % 1 > 0.5 ? 1 : 0);

check(
  Math.abs(pitchX8 - CELL) < 0.01 && Math.abs(pitch1x - CELL) < 0.01,
  `피치 = ${CELL} px (= ${H.cellPx} × ${RAMP_PX}/${H.fontSizePx})`,
  [
    `8× (서브픽셀) y=${rowX8}: 점 ${runsX8.length}개 · 첫 중심 ${(runsX8[0]?.center / 8).toFixed(4)} dp` +
      ` → 끝 ${(runsX8[runsX8.length - 1]?.center / 8).toFixed(4)} dp` +
      ` ⇒ 피치 ${pitchX8.toFixed(5)} px (Δ ${(pitchX8 - CELL).toFixed(5)})`,
    `1× y=${row1x}: 마스크 반복 주기 ${period1x} px = ${cellsInPeriod} 셀` +
      ` ⇒ 피치 ${period1x}/${cellsInPeriod} = ${pitch1x.toFixed(5)} px (Δ ${(pitch1x - CELL).toFixed(5)})`,
    `한 행 점 개수 기대 = round(${ART_W}/${CELL}) = ${EXPECT_DOTS} · 8× 실측 ${runsX8.length}`,
  ],
);
check(
  runsX8.length === EXPECT_DOTS,
  `8× 바닥 도트행의 점 개수 = ${EXPECT_DOTS} (모든 점이 개별로 분리)`,
  [`실측 ${runsX8.length}개 — 하나라도 붙으면 이 수가 줄어든다`],
);

/* ── 어서션 4: 점이 붙지 않는다 ── */
head("4. 망점이 서로 붙지 않는다 (런 < 셀 폭)");
let maxRun1x = 0;
let maxRunRow = -1;
for (let y = 0; y < ramp.h; y += 1) {
  for (const r of paperRuns(ramp, y)) {
    if (r.len > maxRun1x) {
      maxRun1x = r.len;
      maxRunRow = y;
    }
  }
}
let maxRunX8 = 0;
for (let y = 0; y < rampX8.h; y += 1) {
  for (const r of paperRuns(rampX8, y)) maxRunX8 = Math.max(maxRunX8, r.len);
}
const maxRunX8Dp = maxRunX8 / 8;
const bottomRunsX8 = runsX8;
const meanBottomX8 =
  bottomRunsX8.reduce((a, r) => a + r.len, 0) / Math.max(1, bottomRunsX8.length) / 8;
const GAP = CELL - MAX_D;
const MIN_SCALE = 1 / GAP;
check(maxRunX8Dp < CELL, `실제 기하: 최대 런 ${maxRunX8Dp.toFixed(4)} dp < 셀 ${CELL} dp`, [
  `8× 서브픽셀 최대 런 = ${maxRunX8} px ÷ 8 = ${maxRunX8Dp.toFixed(4)} dp` +
    ` = 셀의 ${((maxRunX8Dp / CELL) * 100).toFixed(1)}%  (기대 ${MAX_D.toFixed(4)} dp / ${((MAX_D / CELL) * 100).toFixed(1)}%)`,
  `8× 바닥 도트행 평균 지름 = ${meanBottomX8.toFixed(4)} dp (점 ${bottomRunsX8.length}개)`,
]);
check(Math.abs(maxRunX8Dp - MAX_D) <= 0.15, `최대 지름이 설계식 예측과 ±0.15 dp 안에서 일치`, [
  `예측 2·${DOT_R}·(${CORE}+${(1 - DOT_CUT).toFixed(4)}·${(1 - CORE).toFixed(2)}) = ${MAX_D.toFixed(4)} dp` +
    ` · 실측 ${maxRunX8Dp.toFixed(4)} dp · Δ ${(maxRunX8Dp - MAX_D).toFixed(4)} dp`,
]);
// 1× 는 "포팅 결함"이 아니라 표본화 한계다. 원본 SVG 도 1× 면 같은 일이 난다.
info(
  `1× 최대 런 = ${maxRun1x} px (y=${maxRunRow}) — 점 사이 틈이 ${CELL}−${MAX_D.toFixed(4)}` +
    ` = ${GAP.toFixed(4)} dp 뿐이라 1dp=1px 에서는 픽셀 중심이 틈에 안 들어가 붙어 보인다`,
);
info(
  `  → 점이 분리되어 보이려면 유효 배율 > 1/${GAP.toFixed(4)} = ${MIN_SCALE.toFixed(2)}×.` +
    ` 실기기(320dp 캔버스 → 393dp 화면 DPR3)는 ≈3.7× 이므로 안전. DPR2 폰은 ≈2.5× 로 아슬아슬하다.`,
);

/* ── 어서션 5: 종이색이 정확히 #f6efdc ── */
head("5. 망점 색이 정확히 #f6efdc");
let interior = 0;
let worstDelta = 0;
let worstAt = null;
for (let y = 1; y < ramp.h - 1; y += 1) {
  for (let x = 1; x < ramp.w - 1; x += 1) {
    // 상하좌우가 전부 종이색인 "내부" 픽셀만 본다 (AA 가장자리 제외).
    if (
      !probe.isPaper(x, y) ||
      !probe.isPaper(x - 1, y) ||
      !probe.isPaper(x + 1, y) ||
      !probe.isPaper(x, y - 1) ||
      !probe.isPaper(x, y + 1)
    )
      continue;
    interior += 1;
    const d = probe.delta(x, y, PAPER);
    if (d > worstDelta) {
      worstDelta = d;
      worstAt = [x, y];
    }
  }
}
check(interior > 0 && worstDelta <= 2, `내부 픽셀 ${interior}개가 #f6efdc ±2`, [
  `최대 채널 오차 ${worstDelta}${worstAt ? ` @ (${worstAt[0]}, ${worstAt[1]}) = rgb(${probe.at(worstAt[0], worstAt[1]).slice(0, 3).join(",")})` : ""}`,
  `기준 rgb(${PAPER.join(",")})`,
]);

/* ────────────────────────────── 8. 펀치·그레인 참고 수치 ────────────────────────────── */

head("참고 · 펀치 열 실측 (어서션 아님)");
{
  const p = makeProbe(punch);
  const g = punchGeometry();
  const HOLE = hexRgb(hex("hole"));
  const colX = g.insetPx;
  const centerY = g.topPx + (PUNCH_H - g.topPx - g.bottomPx) / 2;
  const row = Math.round(centerY);
  let flat = 0;
  for (let x = 0; x < punch.w; x += 1) {
    const d = p.delta(x, row, HOLE);
    if (d <= 2 && x < punch.w / 2) flat += 1;
  }
  // 열 중앙 세로선에서 구멍 색이 이어지는 길이 = 구멍 세로 지름
  let vert = 0;
  for (let y = g.topPx; y < PUNCH_H - g.bottomPx; y += 1) {
    if (p.delta(Math.round(colX + g.dotPx / 2), y, HOLE) <= 2) vert += 1;
    else if (vert > 0) break;
  }
  info(
    `farthest-corner 반경 = hypot(${g.dotPx / 2}, ${g.pitchPx / 2}) = ${g.radius.toFixed(4)} px`,
  );
  const solidD = 2 * g.innerStop * g.radius; // 완전 불투명 구멍 지름
  const outerD = 2 * g.outerStop * g.radius; // 알파가 0 이 되는 바깥 지름
  info(
    `innerStop ${g.innerStop} → 반경 ${(g.innerStop * g.radius).toFixed(4)} px > 열 반폭 ${g.dotPx / 2}` +
      ` → 원 좌우가 평평하게 잘린다 (CSS 원본과 같은 인상)`,
  );
  info(
    `좌열 y=${row} 가로 구멍색 폭 = ${flat} px / 열 폭 ${g.dotPx}` +
      ` — inset ${g.insetPx} 이 소수라 양 끝 1px 은 AA 로 섞인다`,
  );
  info(
    `좌열 세로 불투명 지름 ≈ ${vert} px (기대 2×${g.innerStop}×${g.radius.toFixed(3)} = ${solidD.toFixed(3)})`,
  );
  info(
    `구멍 사이 간격: 바깥끝 기준 ${g.pitchPx} − ${outerD.toFixed(3)} = ${(g.pitchPx - outerD).toFixed(3)} px (설계 9.17)` +
      ` · 불투명끝 기준 ${(g.pitchPx - solidD).toFixed(3)} px · 실측 ${(g.pitchPx - vert).toFixed(2)} px`,
  );
}

head("참고 · 그레인 (어서션 아님)");
/** 아래 Blink 대조에서 다시 쓴다. */
const grainBufs = {};
let grainBlinkPng = null;
for (const [file, spec] of [
  ["grain-014", ARTWORK.composition.grain],
  ["grain-016", ARTWORK.cardGrain],
]) {
  const buf = render({
    name: file,
    wDp: GRAIN_W,
    hDp: GRAIN_H,
    write: false,
    draw: (canvas) => {
      fillRect(canvas, 0, 0, GRAIN_W, GRAIN_H, hex("paper"));
      canvas.drawRect(
        skia.XYWHRect(0, 0, GRAIN_W, GRAIN_H),
        makeGrainPaint(skia, {
          baseFrequency: spec.baseFrequency,
          octaves: spec.octaves,
          opacity: spec.opacity,
          tileWidth: GRAIN_W,
          tileHeight: GRAIN_H,
        }),
      );
    },
  });
  grainBufs[file] = buf;
  let sum = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < buf.px.length; i += 4) {
    const v = buf.px[i]; // R 채널. 검은 그레인이라 어두워질수록 작아진다.
    sum += v;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const n = buf.px.length / 4;
  const mean = sum / n;
  info(
    `${file}: opacity ${spec.opacity} · R 평균 ${mean.toFixed(2)} (종이 ${PAPER[0]})` +
      ` · 범위 ${min}..${max} · 평균 어두워짐 ${(PAPER[0] - mean).toFixed(2)}`,
  );
  info(
    `        기대 어두워짐 ≈ ${PAPER[0]} × opacity × E[clamp(6a−3)] — 0.14 vs 0.16 비 ${(0.16 / 0.14).toFixed(4)}`,
  );
}

/* ────────────────────────────── 9. 원본 SVG 교차 검증 ────────────────────────────── */

head("6. 원본 SVG 대조 (Blink / librsvg)");

const artUrl = pathToFileURL(join(REPO, "src", "features", "ticket", "ticket-art.ts")).href;
const { halftoneTextureSvg } = await import(artUrl);
const ORIGINAL_SVG = halftoneTextureSvg({ sizePx: RAMP_PX, idPrefix: "v" });
writeFileSync(join(OUT, "original.svg"), ORIGINAL_SVG, "utf8");
info(
  `원본 = halftoneTextureSvg({ sizePx: ${RAMP_PX}, idPrefix: "v" }) — ${ORIGINAL_SVG.length} bytes`,
);

// 픽셀을 보기 전에, 두 구현이 쓰는 **수치 자체**가 같은지 SVG 문자열에서 직접 읽어 맞춘다.
{
  const grab = (re) => ORIGINAL_SVG.match(re);
  const svgMatrix = grab(/type="matrix" values="([^"]+)"/)[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  const skiaMatrix = thresholdMatrix();
  const svgCell = Number(grab(/<pattern [^>]*width="([\d.]+)"/)[1]);
  const svgDotR = Number(grab(/<circle [^>]*r="([\d.]+)"/)[1]);
  const svgCore = Number(
    grab(/<stop offset="([\d.]+)" stop-color="#ffffff"\/><stop offset="1"/)[1],
  );
  const same = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  check(
    same(svgMatrix, skiaMatrix) && svgCell === CELL && svgDotR === DOT_R && svgCore === CORE,
    "상수 대조: 원본 SVG 문자열에서 읽은 값 == Skia 빌더가 쓰는 값",
    [
      `feColorMatrix values = [${svgMatrix.slice(15).join(" ")}] · thresholdMatrix() = [${skiaMatrix.slice(15).join(" ")}]`,
      `pattern width ${svgCell} == scaleToTile(cellPx) ${CELL} · circle r ${svgDotR} == ${DOT_R}` +
        ` · dot core stop ${svgCore} == ${CORE}`,
    ],
  );
}
info(
  "타일이 150×150 이고 셀 2.6 은 150 을 정수로 안 나눈다 → 가로로 이어 붙이면 위상이 깨진다." +
    " 그래서 램프의 왼쪽 150×150 과만 대조한다 (둘 다 x=0 에서 시작).",
);

/** 인코딩된 PNG → 픽셀 버퍼. 디코더도 이미 띄운 Skia 를 쓴다 (추가 의존성 0). */
function decodePng(bytes, w, h) {
  const img = skia.Image.MakeImageFromEncoded(skia.Data.fromBytes(new Uint8Array(bytes)));
  if (!img) throw new Error("PNG 디코드 실패");
  const px = img.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  return { name: "svg", w, h, px: new Uint8Array(px) };
}

/** Skia 램프에서 왼쪽 size×size 만 잘라 낸다. */
function cropRamp(buf, size, scale) {
  const out = {
    name: "crop",
    w: size * scale,
    h: size * scale,
    px: new Uint8Array(size * scale * size * scale * 4),
  };
  for (let y = 0; y < out.h; y += 1)
    for (let x = 0; x < out.w; x += 1) {
      const a = (y * buf.w + x) * 4;
      const b = (y * out.w + x) * 4;
      out.px[b] = buf.px[a];
      out.px[b + 1] = buf.px[a + 1];
      out.px[b + 2] = buf.px[a + 2];
      out.px[b + 3] = buf.px[a + 3];
    }
  return out;
}

/** 두 버퍼의 픽셀 diff 요약. */
function pixelDiff(a, b) {
  let sumAbs = 0;
  let maxDelta = 0;
  let over8 = 0;
  const n = a.w * a.h;
  for (let i = 0; i < n; i += 1) {
    let worstCh = 0;
    for (let c = 0; c < 3; c += 1) {
      const d = Math.abs(a.px[i * 4 + c] - b.px[i * 4 + c]);
      sumAbs += d;
      worstCh = Math.max(worstCh, d);
    }
    maxDelta = Math.max(maxDelta, worstCh);
    if (worstCh > 8) over8 += 1;
  }
  return { mae: sumAbs / (n * 3), maxDelta, over8, pct: (over8 / n) * 100, n };
}

/** 원본 래스터에 Skia 와 똑같은 기하 계측을 돌린다. 픽셀 diff 보다 이쪽이 판정 기준. */
function geometryOf(buf, scale) {
  const p = makeProbe(buf);
  let firstPaper = -1;
  let firstNonAccent = -1;
  for (let y = 0; y < buf.h && (firstPaper < 0 || firstNonAccent < 0); y += 1)
    for (let x = 0; x < buf.w; x += 1) {
      if (firstNonAccent < 0 && !p.isAccent(x, y)) firstNonAccent = y;
      if (firstPaper < 0 && p.isPaper(x, y)) firstPaper = y;
    }
  const row = bottomDotRow(buf, CELL * scale);
  const runs = paperRuns(buf, row);
  const pitch =
    runs.length > 1
      ? (runs[runs.length - 1].center - runs[0].center) / (runs.length - 1) / scale
      : NaN;
  let maxRun = 0;
  for (let y = 0; y < buf.h; y += 1)
    for (const r of paperRuns(buf, y)) maxRun = Math.max(maxRun, r.len);
  return {
    firstPaperDp: firstPaper / scale,
    firstNonAccentDp: firstNonAccent / scale,
    row,
    dots: runs.length,
    pitch,
    maxRunDp: maxRun / scale,
  };
}

/* ── 레퍼런스 1: Blink (Chromium). 원본 SVG 의 실제 프로덕션 렌더러다 ── */
let chromium = null;
try {
  const req = createRequire(import.meta.url);
  const anchor = realpathSync(join(REPO, "node_modules", "@playwright", "test"));
  chromium = req(req.resolve("playwright-core", { paths: [anchor] })).chromium;
} catch {
  chromium = null;
}

if (!chromium) {
  console.log("SKIP  Blink 레퍼런스 없음 — playwright-core 를 못 찾았다 (설치하지 않는다)");
} else {
  const dataUri =
    "data:image/svg+xml;base64," + Buffer.from(ORIGINAL_SVG, "utf8").toString("base64");
  const page = `<style>html,body{margin:0;padding:0;background:${hex("accent")}}
    img{display:block;width:${RAMP_PX}px;height:${RAMP_PX}px}</style><img src="${dataUri}">`;

  const browser = await chromium.launch();
  const shoot = async (html, w, h, scale) => {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: scale,
    });
    const p = await ctx.newPage();
    await p.setContent(html);
    const bytes = await p.screenshot({ type: "png" });
    await ctx.close();
    return bytes;
  };
  const shots = {
    1: await shoot(page, RAMP_PX, RAMP_PX, 1),
    8: await shoot(page, RAMP_PX, RAMP_PX, 8),
  };
  // 그레인도 같은 브라우저로 떠 둔다 (아래 참고 섹션에서 비교).
  const { cardGrainSvg } = await import(artUrl);
  const grainSvg = cardGrainSvg({ width: GRAIN_W, height: GRAIN_H, idPrefix: "v" });
  grainBlinkPng = await shoot(
    `<style>html,body{margin:0;padding:0;background:${hex("paper")}}` +
      `img{display:block;width:${GRAIN_W}px;height:${GRAIN_H}px}</style>` +
      `<img src="data:image/svg+xml;base64,${Buffer.from(grainSvg, "utf8").toString("base64")}">`,
    GRAIN_W,
    GRAIN_H,
    1,
  );
  const version = browser.version();
  await browser.close();
  writeFileSync(join(OUT, "original-blink.png"), shots[1]);
  writeFileSync(join(OUT, "original-blink-x8.png"), shots[8]);
  info(`Blink ${version} — <img> 안 SVG, 배경 accent. PNG 내보내기 경로와 같은 합성이다.`);

  const blink1 = decodePng(shots[1], RAMP_PX, RAMP_PX);
  const blink8 = decodePng(shots[8], RAMP_PX * 8, RAMP_PX * 8);
  const gSkia1 = geometryOf(cropRamp(ramp, RAMP_PX, 1), 1);
  const gBlink1 = geometryOf(blink1, 1);
  const gSkia8 = geometryOf(cropRamp(rampX8, RAMP_PX, 8), 8);
  const gBlink8 = geometryOf(blink8, 8);

  const fmt = (g) =>
    `첫종이 ${g.firstPaperDp.toFixed(3)}dp · 첫비악센트 ${g.firstNonAccentDp.toFixed(3)}dp` +
    ` · 피치 ${g.pitch.toFixed(5)} · 점 ${g.dots}개 · 최대런 ${g.maxRunDp.toFixed(4)}dp`;
  info(`1×  Skia  ${fmt(gSkia1)}`);
  info(`1×  Blink ${fmt(gBlink1)}`);
  info(`8×  Skia  ${fmt(gSkia8)}`);
  info(`8×  Blink ${fmt(gBlink8)}`);

  const d1 = pixelDiff(cropRamp(ramp, RAMP_PX, 1), blink1);
  const d8 = pixelDiff(cropRamp(rampX8, RAMP_PX, 8), blink8);
  info(
    `픽셀 diff 1× (150×150) — 평균절대오차 ${d1.mae.toFixed(3)}/255 · 최대채널차 ${d1.maxDelta}` +
      ` · >8 픽셀 ${d1.pct.toFixed(2)}% (${d1.over8}/${d1.n})`,
  );
  info(
    `픽셀 diff 8× (1200×1200) — 평균절대오차 ${d8.mae.toFixed(3)}/255 · 최대채널차 ${d8.maxDelta}` +
      ` · >8 픽셀 ${d8.pct.toFixed(2)}% (${d8.over8}/${d8.n})`,
  );
  info(
    "(하드 임계 이미지라 경계 1px 위상차만으로도 최대채널차는 쉽게 200 이 나온다. 판정은 기하 수치로 한다.)",
  );

  check(
    Math.abs(gBlink8.firstPaperDp - gSkia8.firstPaperDp) <= 1,
    "8× · 첫 종이색 y (톤 램프 임계 위치)가 Blink 와 ±1dp 이내",
    [
      `Skia ${gSkia8.firstPaperDp.toFixed(3)}dp · Blink ${gBlink8.firstPaperDp.toFixed(3)}dp` +
        ` · 예측 ${FULL_Y.toFixed(3)}dp · Δ ${(gBlink8.firstPaperDp - gSkia8.firstPaperDp).toFixed(3)}dp`,
    ],
  );
  check(
    Math.abs(gBlink8.pitch - gSkia8.pitch) < 0.01 && gBlink8.dots === gSkia8.dots,
    "8× · 피치와 점 개수가 Blink 와 일치",
    [
      `피치 Skia ${gSkia8.pitch.toFixed(5)} · Blink ${gBlink8.pitch.toFixed(5)} (Δ ${(gBlink8.pitch - gSkia8.pitch).toFixed(5)})`,
      `점 개수 Skia ${gSkia8.dots} · Blink ${gBlink8.dots}`,
    ],
  );
  check(
    Math.abs(gBlink8.maxRunDp - gSkia8.maxRunDp) <= 0.15,
    "8× · 최대 도트 지름이 Blink 와 ±0.15dp 이내",
    [
      `Skia ${gSkia8.maxRunDp.toFixed(4)}dp · Blink ${gBlink8.maxRunDp.toFixed(4)}dp` +
        ` · 설계 예측 ${MAX_D.toFixed(4)}dp · Δ ${(gBlink8.maxRunDp - gSkia8.maxRunDp).toFixed(4)}dp`,
    ],
  );
}

/* ── 레퍼런스 2: librsvg(sharp). OG 경로의 resvg 와는 다른 엔진이라 참고용이다 ── */
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  sharp = null;
}
if (!sharp) {
  info("sharp 없음 — librsvg 참고 래스터는 건너뛴다 (설치하지 않는다).");
} else {
  const raw = await sharp(Buffer.from(ORIGINAL_SVG, "utf8"))
    .resize(RAMP_PX, RAMP_PX)
    .flatten({ background: { r: ACCENT[0], g: ACCENT[1], b: ACCENT[2] } })
    .raw()
    .toBuffer();
  const buf = {
    name: "librsvg",
    w: RAMP_PX,
    h: RAMP_PX,
    px: new Uint8Array(RAMP_PX * RAMP_PX * 4),
  };
  for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
    buf.px[j] = raw[i];
    buf.px[j + 1] = raw[i + 1];
    buf.px[j + 2] = raw[i + 2];
    buf.px[j + 3] = 255;
  }
  await sharp(Buffer.from(ORIGINAL_SVG, "utf8"))
    .resize(RAMP_PX, RAMP_PX)
    .flatten({ background: { r: ACCENT[0], g: ACCENT[1], b: ACCENT[2] } })
    .png()
    .toFile(join(OUT, "original-librsvg.png"));
  const g = geometryOf(buf, 1);
  const d = pixelDiff(cropRamp(ramp, RAMP_PX, 1), buf);
  const p = makeProbe(buf);
  let uniformRows = 0;
  for (let y = 0; y < buf.h; y += 1) {
    let same = true;
    for (let x = 1; x < buf.w; x += 1)
      if (p.at(x, y)[0] !== p.at(0, y)[0]) {
        same = false;
        break;
      }
    if (same) uniformRows += 1;
  }
  info(
    `librsvg(sharp ${sharp.versions.vips ? "vips " + sharp.versions.vips : ""}) 1× — 첫종이 ${g.firstPaperDp}dp` +
      ` · 점 ${g.dots}개 · 가로로 완전 균일한 행 ${uniformRows}/${buf.h}`,
  );
  info(
    `픽셀 diff 1× — 평균절대오차 ${d.mae.toFixed(3)}/255 · 최대채널차 ${d.maxDelta} · >8 픽셀 ${d.pct.toFixed(2)}%`,
  );
  if (uniformRows > buf.h * 0.5 || g.dots < EXPECT_DOTS * 0.5) {
    info(
      "⚠ librsvg 는 2.6px <pattern> 타일을 개별 점으로 못 그리고 평균값으로 뭉갠다 (행이 가로로 균일)." +
        " 이 엔진의 diff 는 포팅 판정 근거가 못 된다 — Blink 수치로 판단한다.",
    );
  }
}

/* ── 7. 그레인 대조 (feTurbulence vs MakeFractalNoise) ── */
head("7. 그레인 대조 — feTurbulence(Blink) vs MakeFractalNoise(Skia)");
if (!grainBlinkPng) {
  console.log("SKIP  Blink 레퍼런스 없음");
} else {
  writeFileSync(join(OUT, "grain-016-blink.png"), grainBlinkPng);
  const b = decodePng(grainBlinkPng, GRAIN_W, GRAIN_H);
  const a = grainBufs["grain-016"];
  // 통계만 같아도 "같은 노이즈"가 아니다. 픽셀 상관계수까지 봐야 같은 난수장이라 말할 수 있다.
  let sa = 0;
  let sb = 0;
  const n = GRAIN_W * GRAIN_H;
  for (let i = 0; i < n; i += 1) {
    sa += a.px[i * 4];
    sb += b.px[i * 4];
  }
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  let maxAbs = 0;
  let sumAbs = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a.px[i * 4] - ma;
    const db = b.px[i * 4] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
    const d = Math.abs(a.px[i * 4] - b.px[i * 4]);
    sumAbs += d;
    maxAbs = Math.max(maxAbs, d);
  }
  const r = cov / Math.sqrt(va * vb);
  info(`Skia 평균 R ${ma.toFixed(3)} (σ ${Math.sqrt(va / n).toFixed(3)})`);
  info(`Blink 평균 R ${mb.toFixed(3)} (σ ${Math.sqrt(vb / n).toFixed(3)})`);
  info(`평균 절대차 ${(sumAbs / n).toFixed(3)}/255 · 최대 ${maxAbs}`);
  check(r > 0.98, `픽셀 상관계수 r = ${r.toFixed(5)} > 0.98 (같은 난수장)`, [
    "SVG feTurbulence(fractalNoise, baseFrequency .9, 2옥타브, stitchTiles=stitch, seed 0) 과",
    "Skia MakeFractalNoise(.9, .9, 2, 0, tileW, tileH) 가 같은 값을 내는지 픽셀 단위로 본다.",
    "r 이 1 에 가까우면 시드·타일링 규약까지 같다는 뜻이다.",
  ]);
  check(
    Math.abs(ma - mb) <= 1.0,
    `평균 밝기 차 ${Math.abs(ma - mb).toFixed(3)} ≤ 1.0 (opacity 적용 순서 동일)`,
    [
      "opacity 를 setAlphaf 로 주면 임계 전에 곱해져 SVG 와 달라진다.",
      "grain.ts 는 임계 행렬 뒤 별도 fade 행렬로 곱한다 — 그 순서가 맞는지 확인한다.",
    ],
  );
}

/* ────────────────────────────── 10. 결과 ────────────────────────────── */

head("결과");
console.log(failures === 0 ? "모든 어서션 통과" : `${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
