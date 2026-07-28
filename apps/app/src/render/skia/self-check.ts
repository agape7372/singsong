import { Skia } from "@shopify/react-native-skia";

import { ARTWORK, hex, scaleToTile } from "./artwork";
import { makeDotTile, makeHalftonePaint } from "./halftone";
import { drawPunchColumn } from "./index";
import { ticketPalette, type Scheme } from "@/theme/tokens";

/**
 * 기기가 자기 자신을 재는 진단.
 *
 * 왜 필요한가 — 실기기 판정은 사람 눈이 정본이지만, 눈으로는 "셀 피치가 2.6인가"를
 * 못 센다. 그리고 라이트 모드는 시스템 테마를 바꿔야 볼 수 있어서 왕복이 는다.
 * 그래서 화면과 **같은 빌더**로 오프스크린 CPU Surface 에 그린 뒤 픽셀을 되읽어
 * 수치를 로그로 뱉는다. Metro 로그에 찍히므로 개발 PC 에서 그대로 읽힌다.
 *
 * 부수 효과가 본론만큼 중요하다: 이 경로가 곧 계획 D4 의 PNG 내보내기 경로다
 * (`Skia.Surface.Make` CPU 백엔드 → `readPixels`). M3 에서 티켓 PNG 를 뽑을 때
 * 쓸 API 가 이 기기에서 실제로 도는지를 M0 에서 확인해 둔다.
 */

const TAG = "[SELFCHECK]";

type Rgb = [number, number, number];

/**
 * 로그가 아니라 배열로 모은다. Expo CLI 는 비대화형(출력 리다이렉트) 실행에서 기기 콘솔을
 * 파일로 흘려주지 않아 개발 PC 에서 읽을 방법이 없다. 화면에 찍으면 사진 한 장으로 전부 건너온다.
 */
const lines: string[] = [];

function log(...parts: unknown[]) {
  const line = parts.map((p) => (typeof p === "string" ? p : String(p))).join(" ");
  lines.push(line);
  console.log(TAG, line);
}

function readRgba(
  width: number,
  height: number,
  draw: (
    canvas: ReturnType<NonNullable<ReturnType<typeof Skia.Surface.Make>>["getCanvas"]>,
  ) => void,
) {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  draw(surface.getCanvas());
  const image = surface.makeImageSnapshot();
  const pixels = image.readPixels();
  if (!pixels || pixels instanceof Float32Array) return null;
  return pixels;
}

function px(buf: Uint8Array, width: number, x: number, y: number): Rgb {
  const o = (y * width + x) * 4;
  return [buf[o]!, buf[o + 1]!, buf[o + 2]!];
}

function near(a: Rgb, b: Rgb, tolerance = 3) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}

function parseHex(css: string): Rgb {
  return [
    parseInt(css.slice(1, 3), 16),
    parseInt(css.slice(3, 5), 16),
    parseInt(css.slice(5, 7), 16),
  ];
}

/** 램프를 8배로 떠서 임계 위치·피치·점 분리를 잰다. 8배는 셀 2.6px 을 20.8px 로 벌려 준다. */
function checkRamp(scale: number) {
  const size = ARTWORK.halftone.fontSizePx;
  const w = Math.round(320 * scale);
  const h = Math.round(size * scale);
  const accent = parseHex(hex("accent"));
  const paper = parseHex(hex("paper"));

  const tile = makeDotTile(Skia, size);
  if (!tile) {
    log(`ramp x${scale}: FAIL — makeDotTile 이 null`);
    return;
  }

  const buf = readRgba(w, h, (canvas) => {
    canvas.scale(scale, scale);
    const bg = Skia.Paint();
    bg.setColor(Skia.Color(hex("accent")));
    canvas.drawRect(Skia.XYWHRect(0, 0, 320, size), bg);
    canvas.drawRect(Skia.XYWHRect(0, 0, 320, size), makeHalftonePaint(Skia, tile, size, 0));
  });
  if (!buf) {
    log(`ramp x${scale}: FAIL — Surface.Make/readPixels 가 null`);
    return;
  }

  const isPaperish = (p: Rgb) => {
    const dp = (p[0] - paper[0]) ** 2 + (p[1] - paper[1]) ** 2 + (p[2] - paper[2]) ** 2;
    const da = (p[0] - accent[0]) ** 2 + (p[1] - accent[1]) ** 2 + (p[2] - accent[2]) ** 2;
    return dp < da;
  };

  // 가로는 4픽셀 간격으로만 센다. 판정 기준이 "1% 이상"이라 정밀도 손실이 없고,
  // Hermes 에서 300만 픽셀을 통째로 도는 동안 JS 스레드가 몇 초 얼어붙는 걸 막는다.
  const STEP = 4;
  let firstPaperRow = -1;
  for (let y = 0; y < h && firstPaperRow < 0; y += 1) {
    let n = 0;
    let seen = 0;
    for (let x = 0; x < w; x += STEP) {
      seen += 1;
      if (isPaperish(px(buf, w, x, y))) n += 1;
    }
    if (n / seen > 0.01) firstPaperRow = y;
  }

  // 맨 아래 행에서 점 개수와 최대 폭 — 붙으면 최대 폭이 셀 폭에 닿는다.
  const yBottom = h - 1;
  let dots = 0;
  let run = 0;
  let maxRun = 0;
  let prev = false;
  for (let x = 0; x < w; x += 1) {
    const on = isPaperish(px(buf, w, x, yBottom));
    if (on && !prev) dots += 1;
    run = on ? run + 1 : 0;
    if (run > maxRun) maxRun = run;
    prev = on;
  }
  const cellPx = scaleToTile(ARTWORK.halftone.cellPx, size) * scale;

  log(
    `ramp x${scale} ${w}x${h}`,
    `| 첫종이행 ${firstPaperRow} = ${((100 * firstPaperRow) / h).toFixed(2)}% (예측 44.32%)`,
    `| 맨아래 점 ${dots}개 · 피치 ${(w / dots).toFixed(3)}px (설계 ${cellPx.toFixed(3)})`,
    `| 최대런 ${maxRun}px = 셀의 ${((100 * maxRun) / cellPx).toFixed(1)}% (설계 81.7%, 100%면 격자)`,
  );
}

/** 라이트·다크 각각의 펀치 카드에서 종이색과 구멍색을 되읽는다. 테마 추종이 맞는지 수치로 본다. */
function checkPunchTheme(scheme: Scheme) {
  const ticket = ticketPalette[scheme];
  const scale = 4;
  const w = 320 * scale;
  const h = 260 * scale;
  const { insetPx, topPx, dotPx, pitchPx } = ARTWORK.punch;

  const buf = readRgba(w, h, (canvas) => {
    canvas.scale(scale, scale);
    const paper = Skia.Paint();
    paper.setAntiAlias(true);
    paper.setColor(Skia.Color(ticket.paper));
    canvas.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(0, 0, 320, 260), ARTWORK.radiusPx, ARTWORK.radiusPx),
      paper,
    );
    const height = 260 - topPx - ARTWORK.punch.bottomPx;
    drawPunchColumn(canvas, {
      x: insetPx,
      top: topPx,
      height,
      holeColor: Skia.Color(ticket.canvas),
    });
  });
  if (!buf) {
    log(`punch ${scheme}: FAIL — Surface.Make/readPixels 가 null`);
    return;
  }

  const paperSample = px(buf, w, Math.round(160 * scale), Math.round(130 * scale));
  // 열 중심의 구멍 하나. `background-position: center` 라 카드 중앙 높이에 구멍 중심이 온다.
  const holeCx = Math.round((insetPx + dotPx / 2) * scale);
  const holeCy = Math.round((topPx + (260 - topPx - ARTWORK.punch.bottomPx) / 2) * scale);
  const holeSample = px(buf, w, holeCx, holeCy);

  // 구멍 세로 지름 대 가로 지름 — 좌우가 잘렸으면 가로가 열 폭에서 딱 끊긴다.
  const isHole = (p: Rgb) => near(p, parseHex(ticket.canvas), 24);
  let vert = 0;
  for (
    let y = holeCy - Math.round(pitchPx * scale);
    y <= holeCy + Math.round(pitchPx * scale);
    y += 1
  ) {
    if (y >= 0 && y < h && isHole(px(buf, w, holeCx, y))) vert += 1;
  }
  let horiz = 0;
  for (let x = 0; x < Math.round(20 * scale); x += 1) {
    if (isHole(px(buf, w, x, holeCy))) horiz += 1;
  }

  log(
    `punch ${scheme}`,
    `| 종이 rgb(${paperSample}) 기대 ${ticket.paper}`,
    `| 구멍 rgb(${holeSample}) 기대 ${ticket.canvas}`,
    `| 일치 ${near(paperSample, parseHex(ticket.paper)) && near(holeSample, parseHex(ticket.canvas)) ? "OK" : "불일치"}`,
    `| 구멍 세로 ${(vert / scale).toFixed(2)}단위 · 가로 ${(horiz / scale).toFixed(2)}단위 (열폭 ${dotPx})`,
  );
}

let ran = false;

/**
 * 한 번만 돈다. Fast Refresh 로 모듈이 다시 평가되면 `lines` 도 같이 초기화되어 다시 돈다.
 * @returns 화면에 그대로 찍을 줄들.
 */
export function runSelfCheck(): string[] {
  if (ran) return lines;
  ran = true;
  const started = globalThis.performance?.now?.() ?? 0;
  try {
    checkRamp(1);
    checkRamp(8);
    checkPunchTheme("light");
    checkPunchTheme("dark");
  } catch (error) {
    log("예외:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  const elapsed = (globalThis.performance?.now?.() ?? 0) - started;
  // 이 시간 자체가 M3 정보다 — PNG 내보내기가 쓸 CPU Surface 경로의 실기기 비용이다.
  log(`오프스크린 CPU Surface 4회 ${elapsed.toFixed(0)}ms`);
  return lines;
}
