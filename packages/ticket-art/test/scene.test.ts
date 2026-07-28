import { describe, expect, it } from "vitest";

import { ARTWORK, DARK_PALETTE, TICKET_COPY, scaleToTile } from "../src/artwork";
import {
  SCENE_PRIMITIVE_KINDS,
  buildTicketScene,
  type ScenePrimitive,
  type ScenePrimitiveKind,
  type TicketModel,
  type TicketSceneOptions,
} from "../src/scene";

/**
 * 여기서 **하지 않는** 테스트: "두 백엔드가 같은 `buildTicketScene()` 반환값을 받는다".
 * 계획이 x==x 라고 폐기했다(정본 계획 §3.3 "골든 테스트의 정직한 범위"). 백엔드 일치는
 * resvg / 헤드리스 CanvasKit 로 각각 래스터화한 **픽셀 diff** 로만 증명된다 — M3.
 *
 * 이 스위트가 지키는 건 씬 자체의 성질이다: variant·theme 해소, export/og 라이트 강제,
 * 정본 540×675 와 다른 크기 사이의 스케일 정합, 선언한 프리미티브의 실제 생산 가능성,
 * 그리고 `qrModules` 부재.
 */

const MODEL: TicketModel = {
  songCount: 23,
  totalLabel: "₩12,000–₩18,000",
  durationLabel: "약 75–105분",
  perPersonLabel: "1인 ₩3,000–₩4,500",
  serial: "A1B2C3D4E5",
  testData: true,
};

const CANONICAL = { width: 540, height: 675 } as const;
const HALF = { width: 270, height: 337.5 } as const;

const card = (theme: "light" | "dark", size = CANONICAL) =>
  buildTicketScene(MODEL, { ...size, variant: "card", theme });

const kindsOf = (primitives: readonly ScenePrimitive[]) =>
  new Set<ScenePrimitiveKind>(primitives.map((p) => p.kind));

function find<K extends ScenePrimitiveKind>(
  primitives: readonly ScenePrimitive[],
  kind: K,
): Extract<ScenePrimitive, { kind: K }>[] {
  return primitives.filter((p): p is Extract<ScenePrimitive, { kind: K }> => p.kind === kind);
}

describe("variant / theme 해소", () => {
  it("card 는 넘긴 테마를 그대로 쓴다", () => {
    expect(card("light").theme).toBe("light");
    expect(card("dark").theme).toBe("dark");
  });

  it("dark card 는 팔레트 값까지 실제로 다크다 — 라벨만 바뀌는 게 아니다", () => {
    const dark = card("dark");
    expect(dark.palette).toEqual(DARK_PALETTE);
    expect(dark.clip.fill).toBe(DARK_PALETTE.paper);
    // 큰 숫자는 악센트. 라이트 #ff3d6e / 다크 #ff6b9b.
    const [count] = find(dark.primitives, "halftoneGlyphs");
    expect(count?.inkColor).toBe(DARK_PALETTE.paper);
    expect(find(dark.primitives, "text").some((t) => t.color === DARK_PALETTE.accent)).toBe(true);
  });

  it("light card 는 아트워크 JSON 팔레트를 그대로 쓴다", () => {
    expect(card("light").palette).toEqual(ARTWORK.palette);
  });
});

describe("export / og 는 언제나 canonical light (정본 §9-2)", () => {
  it("theme 인자 없이도 light 로 해소된다", () => {
    expect(buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }).theme).toBe("light");
    expect(buildTicketScene(MODEL, { ...CANONICAL, variant: "og" }).theme).toBe("light");
  });

  it("theme 을 넘기면 타입이 막고, 뚫고 들어와도 던진다", () => {
    // @ts-expect-error — export 는 `theme?: never`. 이 줄이 에러가 아니게 되면 방어가 뚫린 것이다.
    const forbidden: TicketSceneOptions = { ...CANONICAL, variant: "export", theme: "dark" };
    expect(() => buildTicketScene(MODEL, forbidden)).toThrow(/canonical light/);

    // @ts-expect-error — og 도 같다.
    const forbiddenOg: TicketSceneOptions = { ...CANONICAL, variant: "og", theme: "light" };
    expect(() => buildTicketScene(MODEL, forbiddenOg)).toThrow(/canonical light/);
  });

  it("export 씬 어디에도 다크 팔레트 색이 없다", () => {
    const scene = buildTicketScene(MODEL, { ...CANONICAL, variant: "export" });
    const darkHexes = new Set(Object.values(DARK_PALETTE));
    const used = new Set<string>();
    walk(scene.primitives, (key, value) => {
      if (typeof value === "string" && value.startsWith("#")) used.add(value);
      void key;
    });
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((hex) => darkHexes.has(hex))).toEqual([]);
  });
});

describe("정본 540×675 ↔ 다른 크기 스케일", () => {
  /** 크기와 무관한 값. 나머지 숫자는 전부 폭 비율로 스케일해야 한다. */
  const SCALE_INVARIANT = new Set([
    "opacity",
    "weight",
    "baseFrequency",
    "octaves",
    "dotCoreStop",
    "thresholdGain",
    "thresholdBias",
    "innerStop",
    "outerStop",
    "quietZoneModules",
  ]);
  /** `scaleToTile` 이 소수 셋째 자리에서 반올림한다(artwork.ts). 그만큼만 느슨하게 본다. */
  const ROUNDED = new Set(["cell", "dotRadius"]);
  /** 어파인은 성분마다 성질이 달라 따로 검증한다(아래 별도 it). */
  const SKIP = new Set(["transform", "toneStops"]);

  it("절반 크기 씬은 프리미티브 구조가 같고 숫자만 절반이다", () => {
    const full = buildTicketScene(MODEL, { ...CANONICAL, variant: "export" });
    const half = buildTicketScene(MODEL, { ...HALF, variant: "export" });

    expect(half.primitives.map((p) => p.kind)).toEqual(full.primitives.map((p) => p.kind));

    let compared = 0;
    zip(full.primitives, half.primitives, (path, key, a, b) => {
      if (SKIP.has(key)) return false;
      if (typeof a !== "number" || typeof b !== "number") return true;
      compared += 1;
      if (SCALE_INVARIANT.has(key)) {
        expect(b, `${path} 는 크기 불변이어야 한다`).toBe(a);
      } else {
        expect(b, `${path} 가 절반이 아니다`).toBeCloseTo(a / 2, ROUNDED.has(key) ? 2 : 6);
      }
      return true;
    });
    // 걸어간 숫자가 몇 개 안 되면 위 단언이 아무것도 안 본 것이다. 현재 157개.
    expect(compared).toBeGreaterThan(120);
  });

  it("path 는 좌표를 못 스케일하니 transform 이 대신 스케일된다", () => {
    const full = find(
      buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }).primitives,
      "path",
    );
    const half = find(buildTicketScene(MODEL, { ...HALF, variant: "export" }).primitives, "path");
    expect(full.length).toBeGreaterThan(0);
    expect(half.map((p) => p.d)).toEqual(full.map((p) => p.d));
    for (const [i, a] of full.entries()) {
      const b = half[i]!;
      // [a,b,c,d,e,f] — 순수 확대+이동이라 여섯 성분 중 넷이 절반, 기울기 둘은 0.
      expect(b.transform[0]).toBeCloseTo(a.transform[0] / 2, 6);
      expect(b.transform[3]).toBeCloseTo(a.transform[3] / 2, 6);
      expect(b.transform[4]).toBeCloseTo(a.transform[4] / 2, 6);
      expect(b.transform[5]).toBeCloseTo(a.transform[5] / 2, 6);
      expect([b.transform[1], b.transform[2]]).toEqual([0, 0]);
    }
  });

  it("회전 사각형은 각도가 아니라 회전 중심만 스케일된다", () => {
    const pick = (size: typeof CANONICAL) =>
      find(buildTicketScene(MODEL, { ...size, variant: "export" }).primitives, "rect").find(
        (r) => r.transform !== undefined,
      )!;
    const a = pick(CANONICAL);
    const b = pick(HALF);
    // 아트워크의 오커 사각형 하나만 회전한다(ticket-artwork.json:25-33, deg 16).
    const cos16 = Math.cos((16 * Math.PI) / 180);
    expect(a.transform![0]).toBeCloseTo(cos16, 9);
    expect(b.transform!.slice(0, 4)).toEqual(a.transform!.slice(0, 4));
    expect(b.transform![4]).toBeCloseTo(a.transform![4] / 2, 6);
    expect(b.transform![5]).toBeCloseTo(a.transform![5] / 2, 6);
  });

  it("정본이 아닌 카드 폭에서도 반지름·타공이 폭 비율을 따른다", () => {
    // 오늘 화면 티켓의 실제 상자(globals.css:2506-2508).
    const scene = card("light", { width: 420, height: 700 });
    const s = 420 / 540;
    expect(scene.clip.radius).toBeCloseTo(ARTWORK.radiusPx * s, 9);
    const [left, right] = find(scene.primitives, "punchColumn");
    expect(left?.x).toBeCloseTo(ARTWORK.punch.insetPx * s, 9);
    expect(right?.x).toBeCloseTo(420 - (ARTWORK.punch.insetPx + ARTWORK.punch.dotPx) * s, 9);
    expect(left?.width).toBeCloseTo(ARTWORK.punch.dotPx * s, 9);
  });

  it("크기가 0 이하면 조용히 빈 씬을 내지 않고 던진다", () => {
    expect(() => card("light", { width: 0, height: 675 })).toThrow(/크기/);
    expect(() => card("light", { width: 540, height: -1 })).toThrow(/크기/);
  });
});

describe("선언한 프리미티브는 실제로 만들 수 있어야 한다", () => {
  it("card 씬 하나가 qrModules 를 뺀 전 갈래를 낸다", () => {
    const produced = kindsOf(card("dark").primitives);
    const missing = SCENE_PRIMITIVE_KINDS.filter((kind) => !produced.has(kind));
    expect(missing).toEqual(["qrModules"]);
  });

  it("qrModules 는 어떤 variant·테마 조합에서도 나오지 않는다", () => {
    const scenes = [
      card("light"),
      card("dark"),
      buildTicketScene(
        { ...MODEL, testData: false },
        { ...CANONICAL, variant: "card", theme: "dark" },
      ),
      buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }),
      buildTicketScene({ ...MODEL, testData: false }, { ...CANONICAL, variant: "export" }),
      buildTicketScene(MODEL, { ...CANONICAL, variant: "og" }),
    ];
    for (const scene of scenes) {
      expect(kindsOf(scene.primitives).has("qrModules")).toBe(false);
    }
  });
});

describe("세 렌더러가 갈라져 있던 지점 — 사실로 남기고 판정은 M3 게이트", () => {
  it("① multiply 는 화면 컴포지션 도형에만 붙는다", () => {
    const shapesOf = (p: readonly ScenePrimitive[]) =>
      [...find(p, "circle"), ...find(p, "path")].map((shape) => shape.blend);
    expect(new Set(shapesOf(card("light").primitives))).toEqual(new Set(["multiply"]));
    expect(
      new Set(shapesOf(buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }).primitives)),
    ).toEqual(new Set(["normal"]));
  });

  it("② 큰 숫자 서체가 화면과 내보내기에서 다르다", () => {
    const countFamily = (scene: ReturnType<typeof card>) =>
      find(scene.primitives, "halftoneGlyphs")[0]!.font.family[0];
    expect(countFamily(card("light"))).toBe("Archivo Black");
    expect(countFamily(buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }))).toBe(
      "Pretendard",
    );
  });

  it("③ TEST DATA 는 화면=헤더 문장, 내보내기=스텁 알약", () => {
    const screen = card("light");
    const screenText = find(screen.primitives, "text").find((t) => t.text === TICKET_COPY.testData);
    expect(screenText).toBeDefined();
    // 헤더 문장이므로 컴포지션 밴드보다 위에 있다.
    const band = find(screen.primitives, "grain")[1]!;
    expect(screenText!.y).toBeLessThan(band.y);
    expect(find(screen.primitives, "rrect")).toHaveLength(1); // 카드 몸통뿐, 알약 없음

    const png = buildTicketScene(MODEL, { ...CANONICAL, variant: "export" });
    expect(find(png.primitives, "text").some((t) => t.text === TICKET_COPY.testData)).toBe(false);
    const pillText = find(png.primitives, "text").find((t) => t.text === "TEST DATA")!;
    expect(pillText).toBeDefined();
    // 알약은 스텁 안 — 절취선보다 아래.
    expect(pillText.y).toBeGreaterThan(find(png.primitives, "dashLine")[0]!.y1);
    expect(find(png.primitives, "rrect")).toHaveLength(2); // 카드 몸통 + 알약
    // 화면에서 잃는 문장을 스크린리더는 그대로 듣는다.
    expect(pillText.announce).toBe(TICKET_COPY.testData);
  });

  it("testData 가 꺼지면 어느 쪽에도 흔적이 없다", () => {
    for (const scene of [
      buildTicketScene(
        { ...MODEL, testData: false },
        { ...CANONICAL, variant: "card", theme: "light" },
      ),
      buildTicketScene({ ...MODEL, testData: false }, { ...CANONICAL, variant: "export" }),
    ]) {
      expect(find(scene.primitives, "text").some((t) => t.text.includes("TEST DATA"))).toBe(false);
      expect(find(scene.primitives, "rrect")).toHaveLength(1);
    }
  });
});

describe("백엔드가 기하를 다시 유도하지 않아도 되는가", () => {
  it("타공 열은 farthest-corner 반지름과 0..1 스톱까지 계산돼 있다", () => {
    const [left] = find(card("light").primitives, "punchColumn");
    expect(left!.radius).toBeCloseTo(Math.hypot(left!.width / 2, left!.pitch / 2), 9);
    expect(left!.innerStop).toBeCloseTo(ARTWORK.punch.innerStop / 100, 9);
    expect(left!.outerStop).toBeCloseTo(ARTWORK.punch.outerStop / 100, 9);
    expect(left!.centerY).toBeCloseTo(left!.top + left!.height / 2, 9);
  });

  it("하프톤 셀은 글자 크기에 맞춰 이미 환산돼 있다", () => {
    const [glyphs] = find(
      buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }).primitives,
      "halftoneGlyphs",
    );
    expect(glyphs!.tileSize).toBe(glyphs!.font.size);
    expect(glyphs!.cell).toBe(scaleToTile(ARTWORK.halftone.cellPx, glyphs!.font.size));
    expect(glyphs!.dotRadius).toBe(scaleToTile(ARTWORK.halftone.dotRadiusPx, glyphs!.font.size));
    expect(glyphs!.rampTop).toBe(glyphs!.y);
    expect(glyphs!.toneStops).toEqual(ARTWORK.halftone.toneStops);
  });

  it("letter-spacing 은 em 이 아니라 px 로 환산돼 있다", () => {
    const scene = buildTicketScene(MODEL, { ...CANONICAL, variant: "export" });
    const kicker = find(scene.primitives, "text").find((t) => t.text === TICKET_COPY.kicker)!;
    // ticket-export-card.tsx:131 — 13px · 0.16em.
    expect(kicker.font.size).toBe(13);
    expect(kicker.font.letterSpacing).toBeCloseTo(13 * 0.16, 9);
  });

  it("바코드는 주기와 막대 목록으로 펴져 있다", () => {
    const [bars] = find(
      buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }).primitives,
      "barcodeBars",
    );
    expect(bars!.period).toBe(11);
    expect(bars!.bars).toEqual([
      { offset: 0, width: 2 },
      { offset: 4, width: 3 },
    ]);
    for (const bar of bars!.bars) expect(bar.offset + bar.width).toBeLessThanOrEqual(bars!.period);
  });
});

describe("페인트 순서와 og 의 생략", () => {
  it("화면·PNG 공통 씬에 약 시간과 1인당 금액이 함께 남는다", () => {
    for (const scene of [
      card("light"),
      buildTicketScene(MODEL, { ...CANONICAL, variant: "export" }),
    ]) {
      const summary = find(scene.primitives, "text").find(
        (primitive) => primitive.text === `${MODEL.durationLabel} · ${MODEL.perPersonLabel}`,
      );
      expect(summary).toBeDefined();
      expect(summary?.announce).toBe(`${MODEL.durationLabel}, ${MODEL.perPersonLabel}`);
    }
  });

  it("카드 몸통이 맨 뒤, 타공 열이 맨 앞", () => {
    const { primitives, clip } = card("light");
    expect(primitives[0]).toEqual(clip);
    expect(primitives.slice(-2).map((p) => p.kind)).toEqual(["punchColumn", "punchColumn"]);
  });

  it("고스트가 본문 타이틀보다 먼저 그려진다", () => {
    const { primitives } = card("light");
    const ghost = primitives.findIndex((p) => p.kind === "ghostText");
    const title = primitives.findIndex((p) => p.kind === "text" && p.text === TICKET_COPY.title);
    expect(ghost).toBeGreaterThanOrEqual(0);
    expect(ghost).toBeLessThan(title);
  });

  it("솔리드 숫자 위에 하프톤이 덮인다", () => {
    const { primitives } = card("light");
    const solid = primitives.findIndex((p) => p.kind === "text" && p.text === "23");
    const halftone = primitives.findIndex((p) => p.kind === "halftoneGlyphs");
    expect(solid).toBeLessThan(halftone);
  });

  it("og 는 500px 로 줄면 안 읽히는 시리얼·바코드를 뺀다", () => {
    const og = buildTicketScene(MODEL, { ...CANONICAL, variant: "og" });
    expect(kindsOf(og.primitives).has("barcodeBars")).toBe(false);
    expect(find(og.primitives, "text").some((t) => t.text.includes(MODEL.serial))).toBe(false);
    // 금액은 남는다 — 프리뷰에서 읽혀야 하는 수치다.
    expect(find(og.primitives, "text").some((t) => t.text === MODEL.totalLabel)).toBe(true);
  });

  it("곡수는 화면 글자와 다른 문구로 읽어 준다", () => {
    const count = find(card("light").primitives, "text").find((t) => t.text === "23")!;
    expect(count.announce).toBe("23곡");
  });
});

/* ---------------------------------------------------------------- 헬퍼 --- */

type Visit = (key: string, value: unknown) => void;

function walk(value: unknown, visit: Visit, key = "$"): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, key);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) walk(child, visit, childKey);
    return;
  }
  visit(key, value);
}

/**
 * 두 씬을 나란히 걷는다. `enter` 가 false 를 돌려주면 그 가지는 내려가지 않는다.
 * 스칼라에서는 `enter` 의 반환을 무시한다.
 */
function zip(
  a: unknown,
  b: unknown,
  enter: (path: string, key: string, a: unknown, b: unknown) => boolean,
  path = "$",
  key = "$",
): void {
  if (!enter(path, key, a, b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(b, `${path} 길이가 다르다`).toHaveLength(a.length);
    a.forEach((item, i) => zip(item, b[i], enter, `${path}[${i}]`, key));
    return;
  }
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const keys = Object.keys(a);
    expect(Object.keys(b).sort(), `${path} 키 집합이 다르다`).toEqual([...keys].sort());
    for (const childKey of keys) {
      zip(
        (a as Record<string, unknown>)[childKey],
        (b as Record<string, unknown>)[childKey],
        enter,
        `${path}.${childKey}`,
        childKey,
      );
    }
  }
}
