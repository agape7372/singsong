import { describe, expect, it } from "vitest";

import {
  SCENE_PRIMITIVE_KINDS,
  buildTicketScene,
  renderTicketSceneSvg,
  type ScenePrimitive,
  type TicketModel,
  type TicketScene,
} from "../src";

const MODEL: TicketModel = {
  songCount: 7,
  totalLabel: "₩7,000",
  durationLabel: "약 15–30분",
  perPersonLabel: "1인 ₩3,500",
  serial: "A1B2C3D4E5",
  testData: true,
};

const CARD_SIZE = { width: 540, height: 675 } as const;

function card() {
  return buildTicketScene(MODEL, { ...CARD_SIZE, variant: "card", theme: "light" });
}

function qrPrimitive(): Extract<ScenePrimitive, { kind: "qrModules" }> {
  return {
    kind: "qrModules",
    x: 10,
    y: 20,
    moduleSize: 4,
    quietZoneModules: 1,
    color: "#241c2d",
    modules: [
      [true, false],
      [false, true],
    ],
  };
}

describe("TicketScene SVG backend", () => {
  it("front scene의 전 프리미티브와 qrModules 갈래를 모두 실행한다", () => {
    const front = card();
    const exhaustive: TicketScene = {
      ...front,
      primitives: [...front.primitives, qrPrimitive()],
    };
    const svg = renderTicketSceneSvg(exhaustive, { idPrefix: "front" });

    for (const kind of SCENE_PRIMITIVE_KINDS) {
      expect(svg, kind).toContain(`data-kind="${kind}"`);
    }
    expect(svg).toContain("<feTurbulence");
    expect(svg).toContain('stitchTiles="stitch"');
    expect(svg).toContain("mix-blend-mode:multiply");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toContain("[object Object]");
  });

  it("back처럼 단순화한 텍스트·QR scene도 같은 envelope와 quiet zone을 쓴다", () => {
    const front = card();
    const back: TicketScene = {
      ...front,
      primitives: [
        front.clip,
        {
          kind: "text",
          x: 40,
          y: 44,
          text: "세션 상세",
          font: {
            family: ["Pretendard", "sans-serif"],
            size: 24,
            weight: 800,
            letterSpacing: 0,
            lineHeight: 30,
            tabularNums: false,
          },
          align: "left",
          color: front.palette.ink,
          announce: "세션 상세",
        },
        qrPrimitive(),
      ],
    };
    const svg = renderTicketSceneSvg(back, {
      idPrefix: "back",
      title: "세션 티켓 뒷면",
    });

    expect(svg).toContain('aria-labelledby="back-title back-desc"');
    expect(svg).toContain(">세션 티켓 뒷면</title>");
    expect(svg).toContain(">세션 상세</desc>");
    // x/y 10/20 + quiet zone 1 × module size 4.
    expect(svg).toContain('<rect x="14" y="24" width="4" height="4"/>');
    expect(svg).toContain('<rect x="18" y="28" width="4" height="4"/>');
  });

  it("og scene을 canonical light display list 그대로 독립 SVG로 만든다", () => {
    const og = buildTicketScene(MODEL, {
      width: 540,
      height: 675,
      variant: "og",
    });
    const svg = renderTicketSceneSvg(og, {
      idPrefix: "og-ticket",
      title: "7곡 세션 티켓",
      description: "약 15–30분, 1인 ₩3,500",
    });

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 540 675"');
    expect(svg).toContain('data-ticket-variant="og"');
    expect(svg).toContain(">7곡 세션 티켓</title>");
    expect(svg).toContain(">약 15–30분, 1인 ₩3,500</desc>");
    expect(svg).not.toContain('data-kind="barcodeBars"');
    expect(svg).not.toContain(MODEL.serial);
    expect(svg).not.toMatch(/<script|javascript:/iu);
  });

  it("metadata, visible text, path attributes, and ids cannot break out of XML", () => {
    const base = card();
    const hostile: TicketScene = {
      ...base,
      primitives: [
        base.clip,
        {
          kind: "text",
          x: 20,
          y: 20,
          text: '</text><script>alert("x")</script>&',
          font: {
            family: ['Bad" onload="alert(1)', "sans-serif"],
            size: 16,
            weight: 400,
            letterSpacing: 0,
            lineHeight: 20,
            tabularNums: false,
          },
          align: "left",
          color: '#fff" onload="alert(1)',
        },
        {
          kind: "path",
          d: 'M0 0" onload="alert(1)',
          transform: [1, 0, 0, 1, 0, 0],
          fill: "#000",
        },
      ],
    };
    const svg = renderTicketSceneSvg(hostile, {
      idPrefix: '"><script>',
      title: "<title>&\"'",
      description: "</desc><script>alert(1)</script>",
    });

    expect(svg).toContain("&lt;title&gt;&amp;&quot;&apos;");
    expect(svg).toContain("&lt;/desc&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("&lt;/text&gt;&lt;script&gt;");
    expect(svg).toContain("&quot; onload=&quot;");
    expect(svg).not.toMatch(/<script|onload="/iu);
    expect(svg).not.toContain('id=""><script>');
  });
});
