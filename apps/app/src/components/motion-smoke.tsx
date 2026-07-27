import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  reanimatedVersion,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { palette, radius } from "@/theme/tokens";

/**
 * M2 선행 스모크 — **Reanimated 4.5.0 + worklets 0.10.0 이 이 기기에서 한 번이라도 돈 적이 있는가.**
 *
 * 왜 필요한가. 두 패키지는 M0 dev-client 에 네이티브 모듈로 들어갔지만 `apps/app/src` 어디에도
 * `reanimated`·`worklet` 문자열이 없다(실측 0건). 그리고 **실패가 조용하다** —
 * `@shopify/react-native-skia/lib/module/external/reanimated/renderHelpers.js:5-16` 이
 * `require("react-native-reanimated")` 를 `try/catch` 로 감싸고 실패하면 `HAS_REANIMATED_3=false`
 * 로 두고 넘어간다. 그러면 Skia 는 `StaticContainer` 로 조용히 내려앉는다
 * (`sksg/Container.native.js:70-76`). 즉 **M0 게이트 PASS 는 Reanimated 가 살아 있다는 증거가
 * 아니다.** 그래서 여기서 명시적으로 잰다.
 *
 * 판정 대상은 넷이다.
 *   W1  worklet 이 UI 런타임에서 실제로 돈다
 *   J1  New Architecture 위에서 돈다
 *   A1  `useSharedValue` + `useAnimatedStyle` 이 프레임을 만든다
 *   S1  Skia 캔버스가 Reanimated 로 구동된다  ← M3 이 진짜로 필요한 것
 * G1(제스처)은 덤이다 — M3 의 플립 트리거가 탭이라 같이 밟아 둔다.
 *
 * 읽는 방법은 화면이다. Expo CLI 는 출력 리다이렉트 실행에서 기기 콘솔을 파일로 흘려주지
 * 않는다(`src/render/skia/self-check.ts:26-27` 실측). 그래서 `console.log` 는 보조이고
 * 정본은 화면 — 사진 한 장으로 전부 건너온다.
 */

const TAG = "[MOTION]";

type Scheme = "light" | "dark";

/**
 * Skia 는 네이티브 모듈이라 Expo Go 에는 없다. 지연 `require` 로 감싸면 Expo Go 에서도
 * W1·J1·A1·G1 은 그대로 판정할 수 있다. `src/app/spike.tsx:21-31` 과 같은 관례다.
 */
function loadSkiaBlock(): {
  Component?: typeof import("@/components/motion-skia-canvas").MotionSkiaCanvas;
  error?: string;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { Component: require("@/components/motion-skia-canvas").MotionSkiaCanvas };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function MotionSmoke({ width, scheme }: { width: number; scheme: Scheme }) {
  const colors = palette[scheme];
  const [lines, setLines] = useState<string[]>([]);
  const [fps, setFps] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const reducedMotion = useReducedMotion();

  const report = useCallback((line: string) => {
    setLines((prev) => (prev.includes(line) ? prev : [...prev, line]));
    console.log(TAG, line);
  }, []);

  /* ── W1. worklet 이 UI 런타임에서 도는가 ─────────────────────────────────────── */

  useEffect(() => {
    runOnUI(() => {
      "worklet";
      // `_WORKLET` 은 C++ 이 런타임마다 심는다 — 워클릿 런타임 true / RN 런타임 false
      // (`react-native-worklets/Common/cpp/worklets/WorkletRuntime/WorkletRuntimeDecorator.cpp:67`,
      //  같은 폴더 `RNRuntimeWorkletDecorator.cpp:25`).
      // `__RUNTIME_KIND` 는 1=RN · 2=UI · 3=Worker (`react-native-worklets/lib/module/runtimeKind.js:8-16`).
      //
      // ★ `globalThis` 로 읽는 이유: 맨 식별자(`_WORKLET`)로 쓰면 babel 플러그인이 자유 변수로 보고
      //   `__closure` 에 RN 런타임 값을 담아 보낸다 — 항상 false 가 되어 검사가 무의미해진다.
      //   `globalThis` 는 알려진 전역이라 캡처되지 않는다(프로브로 `__closure={}` 확인).
      const g = globalThis as unknown as { _WORKLET?: boolean; __RUNTIME_KIND?: number };
      runOnJS(report)(
        `W1 runOnUI 진입 · _WORKLET=${String(g._WORKLET)} · __RUNTIME_KIND=${String(g.__RUNTIME_KIND)} (2=UI 면 통과)`,
      );
    })();
  }, [report]);

  /* ── J1. New Architecture · 버전 ──────────────────────────────────────────── */

  // ★ 이펙트가 아니라 **파생값**이다. J1/J2 는 부팅 시점에 이미 고정된 전역을 읽을 뿐이라
  //   시간이 지나도 안 변한다. 이걸 `useEffect` + `report()` 로 넣으면 마운트 직후
  //   setState 가 한 번 더 돌아 `react-hooks/immutability` 의 형제 규칙
  //   ("Calling setState synchronously within an effect")에 정당하게 걸린다 — 그건 오탐이 아니다.
  //   W1 은 다르다: `runOnUI` 왕복이라 비동기이고 이펙트가 맞다.
  const staticLines = useMemo(() => {
    // Reanimated 4 는 New Arch 전용이고 스스로 `RN$Bridgeless` 로 판정한다
    // (`react-native-reanimated/lib/module/ReanimatedModule/NativeReanimated.js:48-50`).
    // Skia 는 `nativeFabricUIManager` 로 본다(`renderer/Canvas.js:39`).
    const g = globalThis as unknown as {
      RN$Bridgeless?: boolean;
      nativeFabricUIManager?: unknown;
      _WORKLET?: boolean;
    };
    return [
      `J1 RN$Bridgeless=${String(g.RN$Bridgeless)} · nativeFabricUIManager=${g.nativeFabricUIManager ? "있음" : "없음"} · JS런타임 _WORKLET=${String(g._WORKLET)} (false 여야 정상)`,
      `J2 reanimated ${reanimatedVersion} · reduce-motion ${reducedMotion ? "★켜짐 — withTiming 이 즉시 끝난다. A1 이 안 움직여도 정상" : "꺼짐"}`,
    ];
  }, [reducedMotion]);

  useEffect(() => {
    // 콘솔에도 남긴다 — 화면을 못 읽는 상황(adb logcat)에서 판정할 수 있어야 한다.
    for (const line of staticLines) console.log(TAG, line);
  }, [staticLines]);

  /* ── A1. useSharedValue + useAnimatedStyle ────────────────────────────────── */

  const progress = useSharedValue(0);
  const travel = Math.max(24, width - 96);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [progress]);

  const puckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
    opacity: 0.35 + progress.value * 0.65,
  }));

  /* ── A2. 프레임이 실제로 나오는가 (UI 스레드에서 세고 1초에 한 번만 건넌다) ───── */

  const frames = useSharedValue(0);
  const windowStart = useSharedValue(-1);

  useFrameCallback((info) => {
    "worklet";
    if (windowStart.value < 0) {
      windowStart.value = info.timeSinceFirstFrame;
      frames.value = 0;
      return;
    }
    frames.value += 1;
    const elapsed = info.timeSinceFirstFrame - windowStart.value;
    // 프레임마다 runOnJS 를 부르면 그 자체가 병목이 된다. 창을 1초로 잡고 한 번만 건넌다.
    if (elapsed >= 1000) {
      runOnJS(setFps)(Math.round((frames.value * 1000) / elapsed));
      frames.value = 0;
      windowStart.value = info.timeSinceFirstFrame;
    }
  });

  /* ── G1. 제스처 콜백 자동 워클릿화 (M3 플립 트리거 경로) ────────────────────── */

  const pressScale = useSharedValue(1);
  const tapTotal = useSharedValue(0);

  // babel 플러그인이 `Gesture.*` 콜백을 자동으로 워클릿화한다
  // (`react-native-worklets/plugin/index.js` 의 gestureHandlerAutoworkletization).
  // `"worklet"` 을 명시해도 결과는 같고, 명시하면 자동화가 깨졌을 때 바로 드러난다.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .onBegin(() => {
          "worklet";
          pressScale.value = withTiming(0.86, { duration: 90 });
        })
        .onFinalize(() => {
          "worklet";
          pressScale.value = withTiming(1, { duration: 200 });
          tapTotal.value += 1;
          runOnJS(setTaps)(tapTotal.value);
        }),
    [pressScale, tapTotal],
  );

  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  /* ── S1. Skia 공존 ────────────────────────────────────────────────────────── */

  const { Component: SkiaBlock, error: skiaError } = loadSkiaBlock();

  return (
    <View style={styles.stack}>
      <Section
        title="0 · 계측 리포트"
        note="사진 한 장에 판정 근거가 다 담기도록 화면에 남긴다. Metro 로그에도 [MOTION] 태그로 같은 줄이 나간다."
        colors={colors}
      >
        <View style={[styles.report, { borderColor: colors.borderSubtle }]}>
          {staticLines.map((line) => (
            <Text key={line} style={[styles.mono, { color: colors.ink }]} selectable>
              {line}
            </Text>
          ))}
          {lines.length === 0 ? (
            <Text style={[styles.mono, { color: colors.inkMuted }]}>W1 측정 중…</Text>
          ) : (
            lines.map((line) => (
              <Text key={line} style={[styles.mono, { color: colors.ink }]} selectable>
                {line}
              </Text>
            ))
          )}
          <Text style={[styles.mono, { color: colors.ink }]} selectable>
            {`A2 useFrameCallback FPS ${fps === null ? "측정 중…" : String(fps)}`}
          </Text>
          <Text style={[styles.mono, { color: colors.ink }]} selectable>
            {`G1 탭 ${taps}회`}
          </Text>
        </View>
      </Section>

      <Section
        title="A1 · useSharedValue → useAnimatedStyle"
        note="분홍 사각형이 좌우로 왕복하며 투명도가 같이 변해야 한다. 끊기면 UI 스레드가 아니라 JS 스레드에서 도는 것이다."
        colors={colors}
      >
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <Animated.View style={[styles.puck, { backgroundColor: colors.accentFill }, puckStyle]} />
        </View>
      </Section>

      <Section
        title="G1 · 제스처 → worklet"
        note="눌렀을 때 즉시 쪼그라들고 떼면 돌아와야 한다. 손가락을 대고 있는 동안에도 위 왕복이 멈추면 안 된다."
        colors={colors}
      >
        <GestureDetector gesture={tap}>
          <Animated.View
            style={[
              styles.tapTarget,
              { backgroundColor: colors.paper, borderColor: colors.borderControl },
              tapStyle,
            ]}
          >
            <Text style={[styles.tapLabel, { color: colors.ink }]}>눌러 보기</Text>
          </Animated.View>
        </GestureDetector>
      </Section>

      <Section
        title="S1 · Skia × Reanimated 공존 (M3 의 진짜 관문)"
        note="캔버스 안 원이 트랙을 따라 왕복하고 반지름이 숨쉬듯 커졌다 작아져야 한다. 위 A1 은 움직이는데 이것만 멈춰 있으면 범인은 worklet 이 아니라 Skia 매퍼다."
        colors={colors}
      >
        {SkiaBlock ? (
          <SkiaBlock
            width={width}
            trackColor={colors.surfaceMuted}
            puckColor={colors.accentFill}
            onReport={report}
          />
        ) : (
          <Text style={[styles.mono, { color: colors.inkMuted }]}>
            {`Skia 를 못 불러왔다 — dev-client 가 아니면 정상이다.\n${skiaError ?? ""}`}
          </Text>
        )}
      </Section>
    </View>
  );
}

function Section({
  title,
  note,
  colors,
  children,
}: {
  title: string;
  note: string;
  colors: (typeof palette)[Scheme];
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.sectionNote, { color: colors.ink }]}>{note}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 26 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionNote: { fontSize: 12, lineHeight: 17, opacity: 0.7, marginBottom: 4 },
  report: { borderWidth: 1, borderRadius: radius.control, padding: 8, gap: 3 },
  mono: { fontSize: 9.5, lineHeight: 13, fontFamily: "monospace" },
  track: { height: 56, borderRadius: radius.strip, justifyContent: "center", paddingLeft: 8 },
  puck: { width: 40, height: 40, borderRadius: radius.action },
  tapTarget: {
    height: 56,
    borderWidth: 1,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
  },
  tapLabel: { fontSize: 14, fontWeight: "600" },
});
