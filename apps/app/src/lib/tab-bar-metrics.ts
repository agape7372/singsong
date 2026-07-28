import { PRIMARY_NAV_CONTENT_HEIGHT } from "../theme/tokens";

export type TabBarMetrics = {
  /** 인셋 포함 전체 높이. `--primary-nav-height` 의 네이티브 등가물. */
  height: number;
  /** 하단 안전영역만큼의 패딩. */
  paddingBottom: number;
  /** 큰 글자 설정에서는 라벨을 끄고 아이콘을 키운다. */
  showLabel: boolean;
  iconSize: number;
  labelFontSize: number;
};

/** 라벨을 끄는 지점. 이 위로는 4개 라벨이 320dp 폭에서 서로 겹친다. */
export const LABEL_OFF_FONT_SCALE = 1.6;

const BASE_ICON = 22;
const LARGE_ICON = 26;
const BASE_LABEL = 11;

/**
 * 기기 없이 단위 테스트할 수 있도록 순수 함수로 분리한다(계획 §3.5).
 * `fontScale` 은 `useWindowDimensions().fontScale` — `PixelRatio.getFontScale()` 은
 * 1회성 읽기라 iOS Dynamic Type 변경을 따라가지 못한다.
 */
export function tabBarMetrics(fontScale: number, insetBottom: number): TabBarMetrics {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const bottom = Number.isFinite(insetBottom) && insetBottom > 0 ? insetBottom : 0;
  const showLabel = scale < LABEL_OFF_FONT_SCALE;
  const iconSize = showLabel ? BASE_ICON : LARGE_ICON;

  // 라벨을 켜 둔 동안에는 글자가 커진 만큼 바도 높아져야 잘리지 않는다.
  // 라벨을 끈 뒤에는 아이콘만 남으므로 더 자라지 않는다.
  const contentHeight = showLabel
    ? PRIMARY_NAV_CONTENT_HEIGHT + Math.round(BASE_LABEL * (scale - 1) * 2)
    : PRIMARY_NAV_CONTENT_HEIGHT;

  return {
    height: contentHeight + bottom,
    paddingBottom: bottom,
    showLabel,
    iconSize,
    labelFontSize: BASE_LABEL,
  };
}
