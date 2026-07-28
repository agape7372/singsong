import {
  Canvas,
  Circle,
  HAS_REANIMATED_3,
  RoundedRect,
  isFabric,
  useCanvasRef,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

/**
 * M2 선행 스모크 — **Skia 캔버스 안의 값을 Reanimated 로 구동한다.**
 *
 * M3 의 플립·발권 모션이 실제로 필요로 하는 경로가 이것 하나다. 나머지(RN View 애니메이션)는
 * 이 경로가 죽어도 우회할 수 있지만 이건 못 우회한다 — 티켓은 Skia 로 그려진다.
 *
 * **왜 `useDerivedValue` 로 감싸는 값과 안 감싸는 값이 갈리는가.**
 * `sksg/Recorder/ReanimatedRecorder.js` 의 `processAnimationValues` 가
 * `Object.values(props)` 만 훑는다 — **1단계**다. 그래서
 *   · `cx={sharedValue}`            → 잡힌다
 *   · `transform={[{ scale: sv }]}` → **못 잡는다**(배열 안이라 1단계가 아니다)
 * 후자는 `useDerivedValue` 로 **배열 전체**를 하나의 SharedValue 로 만들어 넘겨야 한다.
 * 여기서는 둘 다 밟는다(`cx` = 직접, `r` = 파생).
 *
 * 컨테이너 선택은 `sksg/Container.native.js:70-76` 에서 갈린다 —
 * `HAS_REANIMATED_3 && nativeId !== -1` 이면 `NativeReanimatedContainer`(UI 스레드 매퍼),
 * 아니면 `StaticContainer`(정지 화면). **후자로 떨어져도 예외가 안 난다** —
 * `external/reanimated/renderHelpers.js:12` 의 `catch` 가 삼킨다. 그래서 값을 리포트에 찍는다.
 */

const HEIGHT = 72;

export function MotionSkiaCanvas({
  width,
  trackColor,
  puckColor,
  onReport,
}: {
  width: number;
  trackColor: string;
  puckColor: string;
  onReport: (line: string) => void;
}) {
  const ref = useCanvasRef();
  const cx = useSharedValue(24);
  const clock = useSharedValue(0);
  const travel = Math.max(1, width - 48);

  // 프레임마다 **UI 스레드에서** 값을 민다. JS 스레드는 개입하지 않는다 —
  // 이게 도는데 화면이 안 움직이면 범인은 worklet 이 아니라 Skia 매퍼다.
  useFrameCallback((info) => {
    "worklet";
    clock.value = info.timeSinceFirstFrame;
    const period = 1800;
    const t = (info.timeSinceFirstFrame % period) / period;
    const triangle = t < 0.5 ? t * 2 : 2 - t * 2;
    cx.value = 24 + triangle * travel;
  });

  const r = useDerivedValue(() => 10 + 4 * Math.sin(clock.value / 220));

  useEffect(() => {
    onReport(
      `S1 컨테이너=${HAS_REANIMATED_3 ? "NativeReanimatedContainer" : "★StaticContainer — Reanimated 미검출, 캔버스는 정지한다"} · isFabric=${String(isFabric)}`,
    );
  }, [onReport]);

  // 사람 눈 대신 기기가 스스로 재는 보조 근거. 400ms 간격으로 캔버스를 두 번 떠서
  // 픽셀이 바뀌었는지 본다. 실패해도 FAIL 이 아니다 — 온스크린 스냅샷은 M3 의 PNG
  // 내보내기(오프스크린 `Skia.Surface.Make`)와 다른 경로라 여기서 못 읽는 기기가 있을 수 있다.
  useEffect(() => {
    let cancelled = false;

    const sample = async (): Promise<number | null> => {
      const node = ref.current;
      if (!node) return null;
      const image = await node.makeImageSnapshotAsync();
      const pixels = image.readPixels();
      if (!pixels || pixels instanceof Float32Array) return null;
      let hash = 0;
      // 전수 순회는 Hermes 에서 비싸다. 소수 간격 샘플링이면 "바뀌었나" 판정엔 충분하다.
      for (let i = 0; i < pixels.length; i += 997) hash = (hash * 31 + pixels[i]!) % 1_000_003;
      return hash;
    };

    const run = async () => {
      try {
        const before = await sample();
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 400);
        });
        if (cancelled) return;
        const after = await sample();
        if (before === null || after === null) {
          onReport("S2 스냅샷 읽기 실패 — 사람 눈 판정으로 대체(FAIL 아님)");
          return;
        }
        onReport(
          `S2 스냅샷 해시 ${before} → ${after} · ${before === after ? "★변화 없음 — 캔버스가 멈춰 있다" : "변했다 — 매퍼가 프레임을 만든다"}`,
        );
      } catch (error) {
        onReport(
          `S2 스냅샷 예외: ${error instanceof Error ? error.message : String(error)} (FAIL 아님)`,
        );
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onReport, ref]);

  return (
    <Canvas ref={ref} style={{ width, height: HEIGHT }}>
      <RoundedRect
        x={8}
        y={HEIGHT / 2 - 6}
        width={Math.max(1, width - 16)}
        height={12}
        r={6}
        color={trackColor}
      />
      <Circle cx={cx} cy={HEIGHT / 2} r={r} color={puckColor} />
    </Canvas>
  );
}
