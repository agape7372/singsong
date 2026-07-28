import {
  ARTWORK,
  TICKET_COPY,
  resolvePalette,
  scaleToTile,
  type ArtworkShape,
  type Palette,
  type PaletteKey,
  type Theme,
} from "./artwork.js";

/**
 * 티켓 디스플레이 리스트.
 *
 * 오늘은 같은 티켓을 세 렌더러가 각자 그린다 — 화면 DOM, PNG(html-to-image), OG(Satori→resvg).
 * 앞으로는 **씬 하나 + 백엔드 둘**이다: Skia(`apps/app/src/render/skia/`)와
 * SVG 문자열(`services/share-api/src/render/`, M4). 이 파일은 그 씬이다.
 *
 * 계약 세 가지:
 *
 * 1. **좌표는 전부 카드 좌표계의 최종 px.** 백엔드는 기하를 다시 유도하지 않는다.
 *    유일한 예외가 `path.d` — 문자열이라 스케일할 수 없어서 `transform` 을 같이 준다.
 * 2. **순서가 곧 페인트 순서.** `primitives` 는 뒤에서 앞으로 정렬돼 있다.
 * 3. **텍스트의 `y` 는 베이스라인이 아니라 라인박스 상단.** 폰트 메트릭은 백엔드만 안다.
 *    두 백엔드가 같은 자리에 찍으려면 규칙이 하나여야 한다:
 *    `baseline = y + (lineHeight - (ascent + descent)) / 2 + ascent` (ascent·descent 는 양수)
 *    CSS half-leading 과 같은 식이다. 이 한 줄이 SVG `dominant-baseline` 추측과
 *    Skia `drawText` 를 묶는 유일한 계약이라, 백엔드 양쪽에서 이 주석을 인용한다.
 */

/** SVG `matrix(a b c d e f)` 와 같은 순서·의미. 원점 기준 pre-multiply. */
export type Affine = readonly [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/**
 * `mix-blend-mode` 대응. 오늘 화면 티켓만 컴포지션 도형에 `multiply` 를 건다
 * (`globals.css:2829-2831`) — 불일치 ①. 타입이 양쪽을 다 표현할 수 있어야 M3 게이트에서
 * 어느 쪽으로 통일하든 씬만 바꾸면 된다.
 */
export type SceneBlend = "normal" | "multiply";

export type SceneFont = {
  /** 폴백 순서 그대로. 백엔드가 첫 번째로 찾은 것을 쓴다. */
  readonly family: readonly string[];
  readonly size: number;
  readonly weight: number;
  /** em 이 아니라 **px 로 이미 환산**한 값. 백엔드가 size 를 다시 곱하지 않는다. */
  readonly letterSpacing: number;
  readonly lineHeight: number;
  /** 자릿수 폭 고정. 시리얼·금액이 흔들리면 티켓이 티켓처럼 안 보인다. */
  readonly tabularNums: boolean;
};

export type SceneAlign = "left" | "center" | "right";

type Base = { readonly blend?: SceneBlend; readonly opacity?: number };

/** 카드 몸통과 TEST DATA 알약. 클립 도형으로도 쓰인다. */
export type RRectPrimitive = Base & {
  readonly kind: "rrect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
};

/** 컴포지션의 SVG path. `d` 는 아트워크 좌표계, `transform` 이 카드 좌표계로 옮긴다. */
export type PathPrimitive = Base & {
  readonly kind: "path";
  readonly d: string;
  readonly transform: Affine;
  readonly fill: string;
};

export type CirclePrimitive = Base & {
  readonly kind: "circle";
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly fill: string;
};

export type RectPrimitive = Base & {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  /** 회전한 도형만 갖는다(아트워크의 오커 사각형 하나). 없으면 축 정렬. */
  readonly transform?: Affine;
};

/** 스텁 절취선. CSS `dashed` 는 대시 길이를 명세가 정하지 않아 엔진마다 다르다 → 여기서 고정. */
export type DashLinePrimitive = Base & {
  readonly kind: "dashLine";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  /** `[on, off]` px. 값 자체는 실측이 아니라 **핀**이다 — 픽셀 대조는 M3. */
  readonly dash: readonly [number, number];
};

/**
 * 좌우 타공 열. `apps/app/src/render/skia/punch.ts:40` 이 그대로 소비할 수 있게
 * 파생값(모서리까지의 반지름, 0..1 로 바꾼 스톱, 타일 중심)까지 여기서 계산해 넘긴다.
 */
export type PunchColumnPrimitive = Base & {
  readonly kind: "punchColumn";
  readonly side: "left" | "right";
  readonly x: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly pitch: number;
  /** CSS `radial-gradient(circle …)` 의 farthest-corner. `punch.ts:27` 과 같은 식. */
  readonly radius: number;
  readonly innerStop: number;
  readonly outerStop: number;
  /** `background-position: center` — 타일 하나의 중심. 여기서부터 pitch 로 양방향 반복. */
  readonly centerY: number;
  readonly color: string;
};

/** `repeating-linear-gradient(90deg, …)` 를 주기 + 막대 목록으로 편 것. */
export type BarcodeBarsPrimitive = Base & {
  readonly kind: "barcodeBars";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly period: number;
  readonly bars: readonly { readonly offset: number; readonly width: number }[];
};

export type TextPrimitive = Base & {
  readonly kind: "text";
  /** `align` 기준점. left→왼쪽, center→중앙, right→오른쪽. */
  readonly x: number;
  /** 라인박스 상단. 베이스라인 아님 — 파일 상단 계약 3. */
  readonly y: number;
  readonly text: string;
  readonly font: SceneFont;
  readonly align: SceneAlign;
  readonly color: string;
  /**
   * 화면에 그려지는 글자와 **읽어 주는 문구가 다를 때만** 채운다. Skia `<Canvas>` 는 서브트리를
   * 접근성 요소 하나로 붕괴시켜서, 앱은 이 값으로 투명 `<Text>` 오버레이를 기계 생성한다
   * (계획 §3.3 "Skia Canvas 접근성"). 오늘 화면의 `ticket-card.tsx:184` sr-only 가 이것.
   */
  readonly announce?: string;
};

/** 리소 미스레지 고스트 — 본문과 같은 글자를 어긋나게 뒤에 깐다. 항상 장식(읽어 주지 않음). */
export type GhostTextPrimitive = Omit<TextPrimitive, "kind" | "announce"> & {
  readonly kind: "ghostText";
  readonly dx: number;
  readonly dy: number;
};

/**
 * 하프톤 무늬로 채운 글자. `makeHalftonePaint(skia, tile, sizePx, top)` 이
 * 추가 계산 없이 받을 수 있게 스케일이 끝난 값만 담는다
 * (`apps/app/src/render/skia/halftone.ts:41,78,123`).
 */
export type HalftoneGlyphsPrimitive = Base & {
  readonly kind: "halftoneGlyphs";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: SceneFont;
  readonly align: SceneAlign;
  /** 타일 한 변 = 톤 램프가 한 번 흐르는 높이. */
  readonly tileSize: number;
  /** 램프 시작 y(글자 em 박스 상단). `makeHalftoneShader` 의 `top`. */
  readonly rampTop: number;
  readonly cell: number;
  readonly dotRadius: number;
  readonly dotCoreStop: number;
  readonly toneStops: readonly (readonly [number, string])[];
  readonly thresholdGain: number;
  readonly thresholdBias: number;
  /** 망점 색. 종이색이 악센트를 뚫고 나오는 구조라 팔레트 `paper` 다. */
  readonly inkColor: string;
  readonly announce?: string;
};

/** `feTurbulence` + 임계 행렬. `makeGrainPaint` 인자와 1:1. */
export type GrainPrimitive = Base & {
  readonly kind: "grain";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly baseFrequency: number;
  readonly octaves: number;
  /** `stitchTiles="stitch"` 대응. `MakeFractalNoise` 의 tileW/tileH. */
  readonly tileWidth: number;
  readonly tileHeight: number;
};

/**
 * ⚠ **의도적 미충족.** 정본 §9-4 는 `publicUrl` 이 있으면 실제 QR(최소 192×192, quiet zone
 * 4모듈)을 요구하지만 오늘도 미구현이고 MVP 범위 밖이다(계획 §6-9, 원장 기록 완료).
 *
 * 그런데도 유니온에 남긴다. 백엔드의 exhaustive switch 가 이 갈래를 강제로 마주치게 만들어,
 * "언젠가 붙일 것"이 타입에 박혀 있게 하려는 것이다. `buildTicketScene` 은 **절대 방출하지
 * 않는다** — `scene.test.ts` 가 부재를 검사한다. 붙이는 날 필요한 값은 모듈 격자와 배치뿐이다.
 */
export type QrModulesPrimitive = Base & {
  readonly kind: "qrModules";
  readonly x: number;
  readonly y: number;
  readonly moduleSize: number;
  /** row-major 비트맵. `true` = 어두운 모듈. */
  readonly modules: readonly (readonly boolean[])[];
  readonly color: string;
  readonly quietZoneModules: number;
};

export type ScenePrimitive =
  | RRectPrimitive
  | PathPrimitive
  | CirclePrimitive
  | RectPrimitive
  | DashLinePrimitive
  | PunchColumnPrimitive
  | BarcodeBarsPrimitive
  | TextPrimitive
  | GhostTextPrimitive
  | HalftoneGlyphsPrimitive
  | GrainPrimitive
  | QrModulesPrimitive;

export type ScenePrimitiveKind = ScenePrimitive["kind"];

/**
 * 타입이 선언하는 프리미티브 전량.
 *
 * 배열 리터럴이 아니라 `Record<ScenePrimitiveKind, true>` 에서 뽑는다 — 유니온에 갈래를
 * 추가하고 여기 적는 걸 잊으면 **컴파일이 깨진다**(빠진 키 / 남는 키 양쪽 다). 목록이
 * 조용히 낡으면 "선언한 프리미티브는 실제로 만들 수 있어야 한다"는 테스트가 거짓 green 이 된다.
 */
const KIND_REGISTRY = {
  rrect: true,
  path: true,
  circle: true,
  rect: true,
  dashLine: true,
  punchColumn: true,
  barcodeBars: true,
  text: true,
  ghostText: true,
  halftoneGlyphs: true,
  grain: true,
  qrModules: true,
} as const satisfies Record<ScenePrimitiveKind, true>;

export const SCENE_PRIMITIVE_KINDS = Object.keys(KIND_REGISTRY) as readonly ScenePrimitiveKind[];

/**
 * `og` 는 M1 에서 `export` 와 같은 **세로 캔버스**를 쓴다. 오늘의 OG 라우트는 가로 1200×630
 * 2단 구성에 세로 절취선이라 별개 레이아웃이지만, 그 이식은 SVG 백엔드가 생기는 M4 다 —
 * 게다가 계획 §6-10 이 개인화 OG 자체를 정적 브랜드 PNG 로 대체하기로 해서, 그 레이아웃이
 * 살아남는지부터가 M4 결정이다. 지금 옮기면 버려질 코드를 옮기는 것이다.
 */
export type TicketVariant = "card" | "export" | "og";

export type TicketScene = {
  readonly variant: TicketVariant;
  /** **결과** 테마. export·og 는 언제나 `"light"`. 입력 테마가 아니다. */
  readonly theme: Theme;
  readonly width: number;
  readonly height: number;
  readonly palette: Palette;
  /** 카드 밖으로 새는 페인트가 없다. 백엔드는 이걸로 클립하고 시작한다. */
  readonly clip: RRectPrimitive;
  /** 뒤에서 앞으로. */
  readonly primitives: readonly ScenePrimitive[];
};

/**
 * 씬이 그릴 티켓의 값.
 *
 * 금액은 이미 포맷된 문자열(`totalLabel`)을 받는다. 통화 포맷의 정본은
 * `packages/domain/src/format.ts` 의 `formatWonRange` 한 곳이다(C2 에서 Intl.NumberFormat 4벌을
 * 그 순수 정수 포맷터로 통일했다). 여기로 복사하지 않는다 — 두 벌이 되면 서브셋 폰트 두부·
 * 골든 붕괴가 갈라진다. `packages/ticket-art` 가 아니라 `packages/domain` 에 둔 이유는 소비자가
 * 네 트리(`src`·`packages/store`·`apps/app`·`services/share-api`)에 걸쳐 있어서다(계획 §3-1).
 * 이 패키지가 `@singsong/domain` 을 의존해 그 포맷터를 직접 부르는 건 M3 다.
 */
export type TicketModel = {
  readonly songCount: number;
  readonly totalLabel: string;
  readonly durationLabel: string;
  readonly perPersonLabel: string;
  /** 접두사(`NO. `)는 카피에서 붙인다. */
  readonly serial: string;
  readonly testData?: boolean;
};

/**
 * **테마 축은 variant 로 잠근다.**
 *
 * 정본 §9-2: 인앱 티켓은 사용자 테마를 따르고 PNG·OG 는 언제나 canonical light
 * (`docs/FINAL_BLUEPRINT.md:211`, `globals.css:78-79`). 그래서 `export`·`og` 는 `theme` 을
 * "무시"하는 게 아니라 **애초에 받지 못한다** — 잘못 부르면 컴파일이 깨진다.
 * JS 호출자(랜딩 번들·도구 스크립트)를 위해 런타임 assert 도 같이 둔다.
 */
export type TicketSceneOptions =
  | {
      readonly width: number;
      readonly height: number;
      readonly variant: "card";
      readonly theme: Theme;
    }
  | {
      readonly width: number;
      readonly height: number;
      readonly variant: "export" | "og";
      readonly theme?: never;
    };

/* ------------------------------------------------------------------------ *
 * 정본 레이아웃
 * ------------------------------------------------------------------------ */

/**
 * 좌표계의 기준은 PNG 내보내기 540×675 다(`ticket-export-card.tsx:34-35`). 셋 중 유일하게
 * 전 치수가 고정 px 로 못 박힌 렌더러라, 여기 숫자에는 해석의 여지가 없다. 화면 티켓은
 * `clamp()`·`%`·`svh` 로 짜여 있어 기준이 될 수 없고, OG 는 가로 1200×630 별도 구성이다.
 *
 * 다른 크기는 `s = width / 540` 로 **균등 스케일**한다. 세로는 스텁·컴포지션을 아래에 고정하고
 * 헤더를 위에서부터 쌓는다(오늘 export 의 flex 배치와 같은 앵커).
 */
const CANONICAL_WIDTH = 540;

/**
 * ★ **세 렌더러가 이미 갈라져 있던 지점.** M1 은 고르지 않는다 — 오늘의 사실을 variant 별로
 * 그대로 방출하고, 어느 쪽으로 통일할지는 **사용자 게이트 5**(계획 §5, "티켓 불일치 3건 판정
 * — multiply / 숫자 서체 / TEST DATA 위치", M3 골든 동결)에서 정한다.
 *
 *   ① `mix-blend-mode: multiply` — 화면 컴포지션 도형에만(`globals.css:2830`).
 *      PNG·OG 가 쓰는 `compositionSvg`(`ticket-art.ts:162`)에는 곱연산이 없다.
 *   ② 큰 숫자 서체 — 화면 Archivo Black 150px/-0.06em(`globals.css:2795-2800`),
 *      내보내기 Pretendard-900 152px/-0.04em(`ticket-export-card.tsx:47,73-79`),
 *      OG 는 같은 스택에 186px(`api/og/[slug]/route.tsx:77`).
 *   ③ TEST DATA — 화면은 헤더에 문장 전체(`ticket-card.tsx:187-189`),
 *      내보내기는 스텁에 "TEST DATA" 알약(`ticket-export-card.tsx:244-259`).
 *
 * 같은 게이트에서 함께 정리해야 하는 **파생 차이**(단독으로는 판정거리가 아니지만 통일하면
 * 자동으로 정해진다): 카드 테두리 1px(화면만, `globals.css:2513`), 스텁 서체(화면 mono
 * `globals.css:2673` vs 내보내기 본문 스택), 바코드 막대 패턴(주기 11px는 같고 막대 배치가
 * 다름, `globals.css:2706-2714` vs `ticket-export-card.tsx:235`), 고스트 오프셋(3px vs 4px).
 */
const VARIANT_FACTS = {
  card: {
    shapesBlend: "multiply",
    countFamily: ["Archivo Black", "Arial Black", "ui-sans-serif", "system-ui", "sans-serif"],
    countLetterSpacingEm: -0.06,
    testDataInStub: false,
    ghostOffset: 3,
    cardStroke: true,
    barcodeBars: [
      { offset: 0, width: 1 },
      { offset: 3, width: 2 },
      { offset: 6, width: 2 },
    ],
    /** 스텁에 시리얼·바코드를 그리는가. OG 만 뺀다. */
    stubIdentity: true,
  },
  export: {
    shapesBlend: "normal",
    countFamily: null,
    countLetterSpacingEm: -0.04,
    testDataInStub: true,
    ghostOffset: 4,
    cardStroke: false,
    barcodeBars: [
      { offset: 0, width: 2 },
      { offset: 4, width: 3 },
    ],
    stubIdentity: true,
  },
  og: {
    shapesBlend: "normal",
    countFamily: null,
    countLetterSpacingEm: -0.04,
    testDataInStub: true,
    ghostOffset: 4,
    cardStroke: false,
    barcodeBars: [
      { offset: 0, width: 2 },
      { offset: 4, width: 3 },
    ],
    /**
     * OG 는 시리얼·바코드를 뺀다. 취향이 아니라 기록된 결정이다 — 카톡·X 가 1200×630 을
     * 폭 500px 안팎으로 줄여 띄우므로 그 크기에서 안 읽히는 장식은 싣지 않는다
     * (`api/og/[slug]/route.tsx:84-87`).
     */
    stubIdentity: false,
  },
} as const satisfies Record<TicketVariant, unknown>;

const BODY_FAMILY = [
  "Pretendard",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  "system-ui",
  "-apple-system",
  "sans-serif",
] as const;

/**
 * 정본 치수(540×675 기준). 출처는 전부 `ticket-export-card.tsx`.
 *
 * `lineHeight` 가 `normal` 이던 자리는 1.2 로 **핀**한다. `normal` 은 폰트가 정하는 값이라
 * 디스플레이 리스트가 그대로 둘 수 없다 — 백엔드마다 다른 높이가 나온다. 실측 대조는 M3.
 */
const L = {
  padX: 40,
  headerTop: 26,
  kicker: { size: 13, lineHeight: 15.6, weight: 800, letterSpacingEm: 0.16 },
  gapTitle: 8,
  title: { size: 40, lineHeight: 40.8, weight: 900, letterSpacingEm: -0.02 },
  gapCount: 4,
  count: { size: 152, lineHeight: 152, weight: 900 },
  gapCountLabel: 2,
  countLabel: { size: 15, lineHeight: 18, weight: 800, letterSpacingEm: 0.36 },
  gapSummary: 6,
  summary: { size: 13, lineHeight: 15.6, weight: 700, letterSpacingEm: 0.01 },
  gapTestData: 8,
  testDataLine: { size: 11, lineHeight: 13.2, weight: 800, letterSpacingEm: 0.05 },
  compositionGap: 12,
  stub: {
    borderWidth: 2,
    padTop: 14,
    padBottom: 20,
    serial: { size: 17, lineHeight: 20.4, weight: 800, letterSpacingEm: 0.08 },
    price: { size: 22, lineHeight: 26.4, weight: 900, letterSpacingEm: 0.02 },
    barcodeMarginTop: 10,
    barcodeHeight: 28,
    barcodeMarginBottom: 8,
    /** 알약이 있든 없든 스텁 높이가 흔들리지 않게 고정한다. */
    footRowHeight: 20,
    validity: { size: 12, lineHeight: 14.4, weight: 700, letterSpacingEm: 0.04 },
    pill: { size: 10, lineHeight: 12, weight: 700, letterSpacingEm: 0.06, padX: 8, radius: 999 },
  },
  barcodePeriod: 11,
  dash: [6, 6],
} as const;

/** 스텁 전체 높이(정본 단위). 아래에 고정되는 블록이라 헤더보다 먼저 정해진다. */
const STUB_HEIGHT =
  L.stub.borderWidth +
  L.stub.padTop +
  L.stub.price.lineHeight +
  L.stub.barcodeMarginTop +
  L.stub.barcodeHeight +
  L.stub.barcodeMarginBottom +
  L.stub.footRowHeight +
  L.stub.padBottom;

/* ------------------------------------------------------------------------ *
 * 빌더
 * ------------------------------------------------------------------------ */

function font(
  spec: { size: number; lineHeight: number; weight: number; letterSpacingEm?: number },
  s: number,
  options?: { family?: readonly string[]; tabularNums?: boolean },
): SceneFont {
  return {
    family: options?.family ?? BODY_FAMILY,
    size: spec.size * s,
    weight: spec.weight,
    letterSpacing: (spec.letterSpacingEm ?? 0) * spec.size * s,
    lineHeight: spec.lineHeight * s,
    tabularNums: options?.tabularNums ?? false,
  };
}

/** 원점이 아니라 임의의 점을 중심으로 도는 회전. SVG `rotate(deg cx cy)` 와 같다. */
function rotateAbout(deg: number, cx: number, cy: number): Affine {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos];
}

/**
 * 컴포지션 viewBox(320×200)를 밴드 사각형에 `xMidYMid slice` 로 맞춘다.
 * `slice` 라 큰 쪽 배율을 쓰고 넘치는 부분은 밴드 클립에 잘린다.
 */
function fitSlice(bandX: number, bandY: number, bandW: number, bandH: number) {
  const [, , boxW, boxH] = ARTWORK.composition.viewBox;
  const scale = Math.max(bandW / boxW, bandH / boxH);
  return {
    scale,
    tx: bandX + (bandW - boxW * scale) / 2,
    ty: bandY + (bandH - boxH * scale) / 2,
  };
}

function compositionPrimitive(
  shape: ArtworkShape,
  fit: { scale: number; tx: number; ty: number },
  palette: Palette,
  blend: SceneBlend,
): ScenePrimitive {
  const fill = palette[shape.fill as PaletteKey];
  const base = { fill, blend, ...(shape.opacity === undefined ? {} : { opacity: shape.opacity }) };
  const { scale, tx, ty } = fit;

  if (shape.kind === "circle") {
    return {
      kind: "circle",
      cx: tx + shape.cx * scale,
      cy: ty + shape.cy * scale,
      r: shape.r * scale,
      ...base,
    };
  }
  if (shape.kind === "path") {
    // `d` 만은 문자열이라 좌표를 미리 곱해 넣을 수 없다. 유일하게 transform 이 필수인 갈래.
    return { kind: "path", d: shape.d, transform: [scale, 0, 0, scale, tx, ty], ...base };
  }
  const x = tx + shape.x * scale;
  const y = ty + shape.y * scale;
  return {
    kind: "rect",
    x,
    y,
    width: shape.width * scale,
    height: shape.height * scale,
    ...base,
    ...(shape.rotate
      ? {
          transform: rotateAbout(
            shape.rotate.deg,
            tx + shape.rotate.cx * scale,
            ty + shape.rotate.cy * scale,
          ),
        }
      : {}),
  };
}

/**
 * 씬 하나를 만든다.
 *
 * @param options `variant` 가 `export`·`og` 면 `theme` 을 받지 않는다(타입이 막고, 런타임도 막는다).
 */
export function buildTicketScene(model: TicketModel, options: TicketSceneOptions): TicketScene {
  const { width, height, variant, theme: requestedTheme } = options;
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`티켓 씬 크기가 잘못됐다: ${width}×${height}`);
  }
  // 타입으로 이미 막았지만 JS 호출자는 통과한다. 조용히 무시하면 "라이트로 나갔겠거니" 하고
  // 다크 PNG 가 나갈 수 있으니 던진다. 침묵보다 크래시가 낫다.
  if (variant !== "card" && requestedTheme !== undefined) {
    throw new Error(`${variant} 는 항상 canonical light 다(정본 §9-2). theme 을 넘길 수 없다.`);
  }

  const theme: Theme = variant === "card" ? requestedTheme : "light";
  const palette = resolvePalette(theme);
  const facts = VARIANT_FACTS[variant];
  const s = width / CANONICAL_WIDTH;

  const px = (v: number) => v * s;
  const padX = px(L.padX);
  const contentWidth = width - padX * 2;
  const centerX = width / 2;

  const out: ScenePrimitive[] = [];

  /* --- 카드 몸통 ------------------------------------------------------- */
  const clip: RRectPrimitive = {
    kind: "rrect",
    x: 0,
    y: 0,
    width,
    height,
    radius: px(ARTWORK.radiusPx),
    fill: palette.paper,
    ...(facts.cardStroke ? { stroke: palette.border, strokeWidth: px(1) } : {}),
  };
  out.push(clip);

  /* --- 카드 전면 그레인 ------------------------------------------------ */
  // 밴드에만 그레인이 있으면 종이와 밴드 사이에 경계선이 보인다(`ticket-art.ts:188`).
  out.push({
    kind: "grain",
    x: 0,
    y: 0,
    width,
    height,
    baseFrequency: ARTWORK.cardGrain.baseFrequency,
    octaves: ARTWORK.cardGrain.octaves,
    opacity: ARTWORK.cardGrain.opacity,
    blend: ARTWORK.cardGrain.blend,
    tileWidth: width,
    tileHeight: height,
  });

  /* --- 세로 스택 -------------------------------------------------------- */
  // 스텁은 바닥 고정, 헤더는 위에서부터 쌓기, 남는 높이는 컴포지션 밴드가 흡수한다.
  //
  // 오늘 export 는 반대로 **헤더**가 남는 높이를 흡수한다(`ticket-export-card.tsx:113-120`).
  // 그 배치를 그대로 옮기면 안 된다: 540×675 에서 스텁 128.4 + 밴드 290 + 간격 12 을 빼면
  // 헤더 가용 높이가 244.6px 인데 헤더 콘텐츠는 266.4px 다(위 `L` 의 핀한 line-height 기준).
  // 차액 21.8px 가 `overflow: hidden` 에 잘리고, 그 자리가 정확히 맨 아래 "SONGS" 다.
  // 즉 오늘 PNG 에 SONGS 가 안 찍히고 있을 가능성이 크다 — 산술 추정이지 픽셀 확인은 아니다.
  // 밴드는 `slice` 라 애초에 잘려도 되는 유일한 블록이므로 흡수는 밴드가 맡는다. 대조는 M3.
  const stubHeight = px(STUB_HEIGHT);
  const stubTop = height - stubHeight;

  let y = px(L.headerTop);

  const pushText = (
    text: string,
    spec: { size: number; lineHeight: number; weight: number; letterSpacingEm?: number },
    color: string,
    extra?: { family?: readonly string[]; tabularNums?: boolean; announce?: string },
  ) => {
    const f = font(spec, s, extra);
    out.push({
      kind: "text",
      x: centerX,
      y,
      text,
      font: f,
      align: "center",
      color,
      ...(extra?.announce === undefined ? {} : { announce: extra.announce }),
    });
    y += f.lineHeight;
  };

  pushText(TICKET_COPY.kicker, L.kicker, palette.accentText);

  /* --- 타이틀 + 미스레지 고스트 ----------------------------------------- */
  y += px(L.gapTitle);
  const titleFont = font(L.title, s);
  const ghostOffset = px(facts.ghostOffset);
  out.push({
    kind: "ghostText",
    x: centerX,
    y,
    text: TICKET_COPY.title,
    font: titleFont,
    align: "center",
    color: palette.accent,
    dx: ghostOffset,
    dy: ghostOffset,
  });
  out.push({
    kind: "text",
    x: centerX,
    y,
    text: TICKET_COPY.title,
    font: titleFont,
    align: "center",
    color: palette.ink,
  });
  y += titleFont.lineHeight;

  /* --- 큰 숫자: 솔리드 악센트 + 그 위에 하프톤 --------------------------- */
  y += px(L.gapCount);
  const countText = String(model.songCount);
  const countFont = font(
    { ...L.count, letterSpacingEm: facts.countLetterSpacingEm },
    s,
    // 불일치 ②. `null` = 본문 스택(Pretendard-900). M3 게이트에서 한쪽으로 통일된다.
    { family: facts.countFamily ?? BODY_FAMILY, tabularNums: true },
  );
  out.push({
    kind: "text",
    x: centerX,
    y,
    text: countText,
    font: countFont,
    align: "center",
    color: palette.accent,
    announce: `${model.songCount}곡`,
  });
  out.push({
    kind: "halftoneGlyphs",
    x: centerX,
    y,
    text: countText,
    font: countFont,
    align: "center",
    tileSize: countFont.size,
    rampTop: y,
    cell: scaleToTile(ARTWORK.halftone.cellPx, countFont.size),
    dotRadius: scaleToTile(ARTWORK.halftone.dotRadiusPx, countFont.size),
    dotCoreStop: ARTWORK.halftone.dotCoreStop,
    toneStops: ARTWORK.halftone.toneStops,
    thresholdGain: ARTWORK.halftone.thresholdGain,
    thresholdBias: ARTWORK.halftone.thresholdBias,
    inkColor: palette.paper,
  });
  y += countFont.lineHeight;

  y += px(L.gapCountLabel);
  pushText(TICKET_COPY.countLabel, L.countLabel, palette.inkMuted);

  // 화면·PNG에 계산 핵심 세 축(곡수·약 시간·1인당)을 모두 남긴다.
  // 한 줄로 묶어 가변 높이를 늘리지 않고, 백엔드마다 별도 표기를 만들지 않는다.
  y += px(L.gapSummary);
  pushText(`${model.durationLabel} · ${model.perPersonLabel}`, L.summary, palette.inkMuted, {
    announce: `${model.durationLabel}, ${model.perPersonLabel}`,
  });

  // 불일치 ③ — 화면판은 헤더에 문장 전체.
  if (model.testData && !facts.testDataInStub) {
    y += px(L.gapTestData);
    pushText(TICKET_COPY.testData, L.testDataLine, palette.inkMuted);
  }

  /* --- 컴포지션 밴드 ---------------------------------------------------- */
  const bandTop = y + px(L.compositionGap);
  const bandHeight = Math.max(0, stubTop - bandTop);
  if (bandHeight > 0) {
    const fit = fitSlice(0, bandTop, width, bandHeight);
    // 밴드는 자기 종이 바탕을 깐다 — 아래의 카드 그레인이 도형 사이로 비치면
    // 오늘의 PNG(`compositionSvg` 의 backdrop)와 달라진다.
    out.push({ kind: "rect", x: 0, y: bandTop, width, height: bandHeight, fill: palette.paper });
    for (const shape of ARTWORK.composition.shapes) {
      out.push(compositionPrimitive(shape, fit, palette, facts.shapesBlend));
    }
    out.push({
      kind: "grain",
      x: 0,
      y: bandTop,
      width,
      height: bandHeight,
      baseFrequency: ARTWORK.composition.grain.baseFrequency,
      octaves: ARTWORK.composition.grain.octaves,
      opacity: ARTWORK.composition.grain.opacity,
      blend: ARTWORK.composition.grain.blend,
      tileWidth: width,
      tileHeight: bandHeight,
    });
  }

  /* --- 스텁 ------------------------------------------------------------- */
  const dashY = stubTop + px(L.stub.borderWidth) / 2;
  out.push({
    kind: "dashLine",
    x1: 0,
    y1: dashY,
    x2: width,
    y2: dashY,
    stroke: palette.border,
    strokeWidth: px(L.stub.borderWidth),
    dash: [px(L.dash[0]), px(L.dash[1])],
  });

  let sy = stubTop + px(L.stub.borderWidth) + px(L.stub.padTop);
  const rowHeight = px(L.stub.price.lineHeight);

  if (facts.stubIdentity) {
    const serialFont = font(L.stub.serial, s, { tabularNums: true });
    out.push({
      kind: "text",
      x: padX,
      // 두 글자 크기가 baseline 정렬이라 큰 쪽 라인박스 안에서 가운데를 잡는다.
      y: sy + (rowHeight - serialFont.lineHeight) / 2,
      text: `${TICKET_COPY.serialPrefix}${model.serial}`,
      font: serialFont,
      align: "left",
      color: palette.ink,
    });
  }
  out.push({
    kind: "text",
    x: width - padX,
    y: sy,
    text: model.totalLabel,
    font: font(L.stub.price, s, { tabularNums: true }),
    align: "right",
    color: palette.money,
  });
  sy += rowHeight + px(L.stub.barcodeMarginTop);

  if (facts.stubIdentity) {
    out.push({
      kind: "barcodeBars",
      x: padX,
      y: sy,
      width: contentWidth,
      height: px(L.stub.barcodeHeight),
      color: palette.ink,
      period: px(L.barcodePeriod),
      bars: facts.barcodeBars.map((bar) => ({ offset: px(bar.offset), width: px(bar.width) })),
    });
  }
  sy += px(L.stub.barcodeHeight) + px(L.stub.barcodeMarginBottom);

  const footRow = px(L.stub.footRowHeight);
  const validityFont = font(L.stub.validity, s);
  out.push({
    kind: "text",
    x: padX,
    y: sy + (footRow - validityFont.lineHeight) / 2,
    text: TICKET_COPY.validity,
    font: validityFont,
    align: "left",
    color: palette.inkMuted,
  });

  // 불일치 ③ — 내보내기판은 스텁에 알약. 헤더에 두면 675px 안에서 잘린다
  // (`ticket-export-card.tsx:244`).
  if (model.testData && facts.testDataInStub) {
    const pillFont = font(L.stub.pill, s);
    const pillWidth = px(L.stub.pill.padX) * 2 + pillFont.size * "TEST DATA".length * 0.62;
    out.push({
      kind: "rrect",
      x: width - padX - pillWidth,
      y: sy,
      width: pillWidth,
      height: footRow,
      radius: px(L.stub.pill.radius),
      stroke: palette.inkMuted,
      strokeWidth: px(1),
    });
    out.push({
      kind: "text",
      x: width - padX - pillWidth / 2,
      y: sy + (footRow - pillFont.lineHeight) / 2,
      text: "TEST DATA",
      font: pillFont,
      align: "center",
      color: palette.inkMuted,
      announce: TICKET_COPY.testData,
    });
  }

  /* --- 타공 열(맨 앞) --------------------------------------------------- */
  const { dotPx, pitchPx, insetPx, topPx, bottomPx, innerStop, outerStop } = ARTWORK.punch;
  const punchTop = px(topPx);
  const punchHeight = Math.max(0, height - px(topPx) - px(bottomPx));
  for (const side of ["left", "right"] as const) {
    out.push({
      kind: "punchColumn",
      side,
      x: side === "left" ? px(insetPx) : width - px(insetPx) - px(dotPx),
      top: punchTop,
      width: px(dotPx),
      height: punchHeight,
      pitch: px(pitchPx),
      // farthest-corner. `punch.ts:27` 과 같은 식이어야 원의 좌우 잘림이 재현된다.
      radius: Math.hypot(px(dotPx) / 2, px(pitchPx) / 2),
      innerStop: innerStop / 100,
      outerStop: outerStop / 100,
      centerY: punchTop + punchHeight / 2,
      color: palette.hole,
    });
  }

  return { variant, theme, width, height, palette, clip, primitives: out };
}
