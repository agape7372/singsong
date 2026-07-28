import { Canvas, Circle, Group, Path } from "@shopify/react-native-skia";
import type { ColorValue } from "react-native";

export type TabGlyphName = "plan" | "library" | "discover" | "settings";

const PATHS = {
  plan: ["M6 4.5h12v15H6z", "M9 8h6M9 12h6M9 16h4"],
  library: ["M5 5h14v14H5z", "M5 9h14", "M10 14h4"],
  discover: ["m15 9-3.5 1.5L10 15l3.5-1.5z"],
  settings: [
    "M12 3.5v2.5M12 18v2.5M20.5 12H18M6 12H3.5M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8M17.7 17.7l-1.8-1.8M8.1 8.1 6.3 6.3",
  ],
} as const;

/**
 * 웹 탭의 SVG `d`를 같은 24×24 좌표계로 Skia에 옮긴다. RN SVG 의존성을
 * 추가하지 않고 티켓 렌더러와 같은 네이티브 그래픽 스택만 사용한다.
 */
export function TabGlyph({
  name,
  size,
  color,
}: {
  name: TabGlyphName;
  size: number;
  color: ColorValue;
}) {
  const scale = size / 24;
  // Tabs는 이 앱이 넘긴 hex 토큰을 그대로 돌려주지만 RN 타입은 PlatformColor까지
  // 포함한 ColorValue로 넓혀 둔다. Skia에는 실제 런타임 값인 hex 문자열을 전달한다.
  const skiaColor = color as string;
  return (
    <Canvas
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Group transform={[{ scale }]}>
        {name === "discover" ? (
          <Circle color={skiaColor} cx={12} cy={12} r={8} style="stroke" strokeWidth={1.75} />
        ) : null}
        {name === "settings" ? (
          <Circle color={skiaColor} cx={12} cy={12} r={3} style="stroke" strokeWidth={1.75} />
        ) : null}
        {PATHS[name].map((path) => (
          <Path
            key={path}
            color={skiaColor}
            path={path}
            style="stroke"
            strokeCap="round"
            strokeJoin="round"
            strokeWidth={1.75}
          />
        ))}
      </Group>
    </Canvas>
  );
}
