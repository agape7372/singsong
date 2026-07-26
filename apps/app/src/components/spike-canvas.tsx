import {
  Canvas,
  FontWeight,
  Picture,
  Skia,
  type SkCanvas,
  type SkFont,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ARTWORK,
  color,
  drawPunchColumn,
  hex,
  makeDotTile,
  makeGrainPaint,
  makeHalftonePaint,
  scaleToTile,
} from "@/render/skia";
import { runSelfCheck } from "@/render/skia/self-check";
import { palette, ticketPalette } from "@/theme/tokens";

/**
 * M0 게이트용 스파이크. 판정 대상은 **하프톤 점 분포·그레인 입자감·펀치 구멍 모양** 셋뿐이다.
 *
 * 서체는 판정 대상이 아니다 — repo 에 `@font-face` 가 하나도 없어 오늘의 화면도
 * Arial Black / Apple SD Gothic Neo **폴백**이고, 번들 서브셋 도입은 M3 의 별도 사용자 게이트다.
 * 그래서 숫자 글리프는 시스템 최대 굵기로 그리고, 그 위에 **서체와 무관한 램프 스와치**를
 * 따로 둔다. 원본과 픽셀 대조할 대상은 램프 쪽이다.
 */

/** 아트워크 좌표계 폭. 캔버스는 이 폭 기준으로 스케일된다. */
const ART_W = 320;
/** 톤 램프는 글자 크기 한 번에 걸쳐 흐른다. 정본 `halftone.fontSizePx`. */
const RAMP_PX = ARTWORK.halftone.fontSizePx;

type Scheme = "light" | "dark";

function useScene(
  width: number,
  height: number,
  draw: (canvas: SkCanvas) => void,
  deps: unknown[],
) {
  return useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    draw(canvas);
    return recorder.finishRecordingAsPicture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);
}

function fillRect(canvas: SkCanvas, x: number, y: number, w: number, h: number, css: string) {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(css));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
}

/* ─────────────────────────── 1. 램프 스와치 (서체 무관) ─────────────────────────── */

function RampScene({ scale, tile }: { scale: number; tile: SkImage }) {
  const w = ART_W * scale;
  const h = RAMP_PX * scale;

  const picture = useScene(
    w,
    h,
    (canvas) => {
      canvas.scale(scale, scale);
      fillRect(canvas, 0, 0, ART_W, RAMP_PX, hex("accent"));
      canvas.drawRect(Skia.XYWHRect(0, 0, ART_W, RAMP_PX), makeHalftonePaint(tile, RAMP_PX, 0));
    },
    [scale, tile],
  );

  return <Canvas style={{ width: w, height: h }}>{<Picture picture={picture} />}</Canvas>;
}

/* ─────────────────────────── 2. 하프톤 숫자 ─────────────────────────── */

function NumeralScene({ scale, tile, font }: { scale: number; tile: SkImage; font: SkFont }) {
  const w = ART_W * scale;
  const h = 210 * scale;

  const picture = useScene(
    w,
    h,
    (canvas) => {
      canvas.scale(scale, scale);
      fillRect(canvas, 0, 0, ART_W, 210, hex("paper"));

      const text = "12";
      const metrics = font.getMetrics();
      const bounds = font.measureText(text);
      const baseline = 175;
      // CSS `background-clip:text` 는 요소 박스 상단부터 램프를 흘린다.
      // 글리프 em 박스 상단 = baseline + ascent (ascent 는 음수).
      const emTop = baseline + metrics.ascent;
      const x = (ART_W - bounds.width) / 2;

      const base = Skia.Paint();
      base.setAntiAlias(true);
      base.setColor(color("accent"));
      canvas.drawText(text, x, baseline, base, font);

      // 종이색 망점을 같은 글리프 위에 겹쳐 찍는다.
      canvas.drawText(text, x, baseline, makeHalftonePaint(tile, RAMP_PX, emTop), font);
    },
    [scale, tile, font],
  );

  return <Canvas style={{ width: w, height: h }}>{<Picture picture={picture} />}</Canvas>;
}

/* ─────────────────────────── 3. 그레인 ─────────────────────────── */

function GrainScene({ scale }: { scale: number }) {
  const w = ART_W * scale;
  const h = 130 * scale;

  const picture = useScene(
    w,
    h,
    (canvas) => {
      canvas.scale(scale, scale);
      const half = ART_W / 2;
      const specs = [
        { x: 0, spec: ARTWORK.composition.grain },
        { x: half, spec: ARTWORK.cardGrain },
      ];
      for (const { x, spec } of specs) {
        fillRect(canvas, x, 0, half, 130, hex("paper"));
        canvas.save();
        canvas.translate(x, 0);
        canvas.drawRect(
          Skia.XYWHRect(0, 0, half, 130),
          makeGrainPaint({
            baseFrequency: spec.baseFrequency,
            octaves: spec.octaves,
            opacity: spec.opacity,
            tileWidth: half,
            tileHeight: 130,
          }),
        );
        canvas.restore();
      }
      // 두 패치 경계선 — 0.14 와 0.16 차이가 보이는지 확인용
      fillRect(canvas, half - 0.5, 0, 1, 130, hex("border"));
    },
    [scale],
  );

  return <Canvas style={{ width: w, height: h }}>{<Picture picture={picture} />}</Canvas>;
}

/* ─────────────────────────── 4. 펀치 열 ─────────────────────────── */

function PunchScene({ scale, scheme }: { scale: number; scheme: Scheme }) {
  const w = ART_W * scale;
  const h = 260 * scale;

  const picture = useScene(
    w,
    h,
    (canvas) => {
      canvas.scale(scale, scale);
      // 인앱 티켓 종이는 테마를 따른다(정본 §9-2). PNG·OG 만 항상 라이트로 굽는다.
      const ticket = ticketPalette[scheme];
      const paper = Skia.Paint();
      paper.setAntiAlias(true);
      paper.setColor(Skia.Color(ticket.paper));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(0, 0, ART_W, 260), ARTWORK.radiusPx, ARTWORK.radiusPx),
        paper,
      );

      const { insetPx, topPx, dotPx } = ARTWORK.punch;
      // 구멍 너머로 보이는 색은 카드 뒤 캔버스다. 값을 따로 적으면 테마마다 어긋나므로
      // `--ticket-canvas` 를 그대로 쓴다 — VISUAL_MOTION_DIRECTION §651 이 요구하는 규칙.
      const hole = Skia.Color(ticket.canvas);
      const height = 260 - topPx - ARTWORK.punch.bottomPx;

      drawPunchColumn(canvas, { x: insetPx, top: topPx, height, holeColor: hole });
      drawPunchColumn(canvas, { x: ART_W - insetPx - dotPx, top: topPx, height, holeColor: hole });
    },
    [scale, scheme],
  );

  return <Canvas style={{ width: w, height: h }}>{<Picture picture={picture} />}</Canvas>;
}

/* ─────────────────────────── 조립 ─────────────────────────── */

export function SpikeCanvas({ width, scheme }: { width: number; scheme: Scheme }) {
  const scale = width / ART_W;

  // 눈으로 못 세는 것(셀 피치·점 분리·라이트 팔레트)을 기기가 스스로 잰다.
  const [report, setReport] = useState<string[]>([]);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    setReport([
      `${Platform.OS} ${String(Platform.Version)} · ${Math.round(win.width)}x${Math.round(win.height)}dp @${win.scale}x · fontScale ${win.fontScale}`,
      `safe-area 상${Math.round(insets.top)} 하${Math.round(insets.bottom)} 좌${Math.round(insets.left)} 우${Math.round(insets.right)} · 테마 ${scheme}`,
      `캔버스 폭 ${width}dp → 램프 배율 ${(width / ART_W).toFixed(3)} · 실효 셀 ${(2.6 * (width / ART_W) * win.scale).toFixed(2)} 디바이스px (2.10배 미만이면 격자)`,
      ...runSelfCheck(),
    ]);
  }, [win, insets, scheme, width]);

  const tile = useMemo(() => makeDotTile(RAMP_PX), []);
  const font = useMemo(() => {
    // 시스템 최대 굵기. Android 는 Roboto Black, iOS 는 SF Pro Black 근사치가 잡힌다.
    const typeface = Skia.FontMgr.System().matchFamilyStyle("sans-serif", {
      weight: FontWeight.Black,
    });
    return Skia.Font(typeface ?? undefined, RAMP_PX);
  }, []);

  if (!tile) {
    return <Failure reason="Skia.Surface.Make 가 null 을 반환했다 — 도트 타일을 못 만들었다." />;
  }

  const cell = scaleToTile(ARTWORK.halftone.cellPx, RAMP_PX);
  const dotRadius = scaleToTile(ARTWORK.halftone.dotRadiusPx, RAMP_PX);

  return (
    <View style={styles.stack}>
      <Section
        title="0 · 기기 자가측정"
        note="눈으로 못 세는 값을 기기가 오프스크린 CPU Surface 에 그려 픽셀을 되읽어 잰다. 이 경로가 곧 M3 의 PNG 내보내기 경로다."
      >
        <SelfCheckReport lines={report} />
      </Section>

      <Section
        title="1 · 램프 스와치 (서체 무관)"
        note={`셀 ${cell}dp · 점 반지름 ${dotRadius}dp · 임계 A′=42L−8.4. 위는 구멍 없는 솔리드, 아래로 갈수록 종이색 망점이 커져야 한다.`}
      >
        <RampScene scale={scale} tile={tile} />
      </Section>

      <Section
        title="2 · 하프톤 숫자"
        note="글리프 모양은 시스템 폰트라 원본과 다르다. 볼 것은 망점이 글자 안에서만 흐르는지."
      >
        <NumeralScene scale={scale} tile={tile} font={font} />
      </Section>

      <Section
        title="3 · 그레인 (왼쪽 0.14 · 오른쪽 0.16)"
        note="feTurbulence fractalNoise baseFrequency 0.9 / 2옥타브. 좌우 차이가 미세하게 보이면 정상."
      >
        <GrainScene scale={scale} />
      </Section>

      <Section
        title="4 · 펀치 열"
        note="구멍 좌우가 평평하게 잘려야 맞다 (42% = 4.213dp > 열 반폭 4dp). 구멍 간 간격 9.17dp."
      >
        <PunchScene scale={scale} scheme={scheme} />
      </Section>
    </View>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const ink = palette[useColorScheme() === "dark" ? "dark" : "light"].ink;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: ink }]}>{title}</Text>
      <Text style={[styles.sectionNote, { color: ink }]}>{note}</Text>
      {children}
    </View>
  );
}

function SelfCheckReport({ lines }: { lines: string[] }) {
  const colors = palette[useColorScheme() === "dark" ? "dark" : "light"];
  if (lines.length === 0) {
    return <Text style={[styles.mono, { color: colors.inkMuted }]}>측정 중…</Text>;
  }
  return (
    <View style={[styles.report, { borderColor: colors.borderSubtle }]}>
      {lines.map((line) => (
        <Text key={line} style={[styles.mono, { color: colors.ink }]} selectable>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Failure({ reason }: { reason: string }) {
  return <Section title="렌더 실패" note={reason} children={null} />;
}

const styles = StyleSheet.create({
  stack: { gap: 28 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionNote: { fontSize: 12, lineHeight: 17, opacity: 0.7, marginBottom: 4 },
  report: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 3 },
  mono: { fontSize: 9.5, lineHeight: 13, fontFamily: "monospace" },
});
