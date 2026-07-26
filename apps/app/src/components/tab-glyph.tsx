import { StyleSheet, View, type ColorValue } from "react-native";

export type TabGlyphName = "plan" | "library" | "discover" | "settings";

/**
 * M0 자리표시 아이콘. `planner-tabs.tsx` 의 SVG path 를 Skia 로 옮기는 작업은
 * M0-5(스파이크) 이후 M2 에서 한다 — Expo Go 는 Skia 네이티브 모듈을 못 싣기 때문에
 * 4탭 확인 단계에서는 순수 View 도형으로 대신한다.
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
  const stroke = { borderColor: color, borderWidth: 1.75 };

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {name === "plan" && (
        <View style={[styles.fill, stroke, { borderRadius: 2 }]}>
          <View style={styles.lines}>
            <View style={[styles.line, { backgroundColor: color, width: "70%" }]} />
            <View style={[styles.line, { backgroundColor: color, width: "70%" }]} />
            <View style={[styles.line, { backgroundColor: color, width: "45%" }]} />
          </View>
        </View>
      )}
      {name === "library" && (
        <View style={[styles.fill, stroke, { borderRadius: 2 }]}>
          <View style={[styles.divider, { backgroundColor: color }]} />
          <View style={styles.libraryBody}>
            <View style={[styles.line, { backgroundColor: color, width: "40%" }]} />
          </View>
        </View>
      )}
      {name === "discover" && (
        <View style={[styles.fill, stroke, { borderRadius: size / 2 }]}>
          <View style={[styles.needle, { backgroundColor: color }]} />
        </View>
      )}
      {name === "settings" && (
        <View style={[styles.fill, stroke, { borderRadius: size / 2 }]}>
          <View
            style={[
              styles.hub,
              { borderColor: color, width: size * 0.3, height: size * 0.3, borderRadius: size },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  fill: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  lines: { alignSelf: "stretch", alignItems: "center", gap: 2 },
  line: { height: 1.75, borderRadius: 1 },
  divider: { position: "absolute", top: "28%", left: 0, right: 0, height: 1.75 },
  libraryBody: { marginTop: "20%", alignSelf: "stretch", alignItems: "center" },
  needle: { width: "42%", height: "42%", transform: [{ rotate: "45deg" }] },
  hub: { borderWidth: 1.75 },
});
