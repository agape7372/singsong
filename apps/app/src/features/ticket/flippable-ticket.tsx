import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { TicketSnapshot } from "@singsong/domain";
import { resolvePalette, type Theme } from "@singsong/ticket-art";

import { MIN_TOUCH_TARGET } from "@/theme/tokens";
import { TicketBack } from "./ticket-back";
import {
  buildTicketCardScene,
  TicketFront,
  ticketSceneAccessibilityLabel,
  TICKET_ASPECT_RATIO,
} from "./ticket-front";
import { useReducedMotion } from "./use-reduced-motion";

export function FlippableTicket({
  ticket,
  theme,
  width,
  animateIssue,
}: {
  ticket: TicketSnapshot;
  theme: Theme;
  width: number;
  animateIssue: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const reducedMotion = useReducedMotion();
  const flipProgress = useSharedValue(0);
  const issueProgress = useSharedValue(animateIssue ? 0 : 1);
  const height = width / TICKET_ASPECT_RATIO;
  const scale = width / 540;
  const colors = resolvePalette(theme);
  const scene = useMemo(() => buildTicketCardScene(ticket, theme, width), [theme, ticket, width]);
  const frontLabel = useMemo(() => ticketSceneAccessibilityLabel(scene), [scene]);

  useEffect(() => {
    cancelAnimation(issueProgress);
    if (!animateIssue || reducedMotion) {
      issueProgress.value = 1;
      return;
    }

    issueProgress.value = 0;
    issueProgress.value = withTiming(1, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    return () => cancelAnimation(issueProgress);
  }, [animateIssue, issueProgress, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) return;
    cancelAnimation(flipProgress);
    flipProgress.value = flipped ? 1 : 0;
  }, [flipProgress, flipped, reducedMotion]);

  function setFace(nextFlipped: boolean) {
    setFlipped(nextFlipped);
    cancelAnimation(flipProgress);
    flipProgress.value = withTiming(nextFlipped ? 1 : 0, {
      duration: reducedMotion ? 0 : 320,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
    });
    AccessibilityInfo.announceForAccessibility(nextFlipped ? "티켓 뒷면 상세" : "티켓 앞면");
  }

  const issueStyle = useAnimatedStyle(() => {
    const progress = issueProgress.value;
    const rotation = interpolate(progress, [0, 1], [-0.6, 0], Extrapolation.CLAMP);
    return {
      opacity: interpolate(progress, [0, 0.18, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(progress, [0, 1], [22, 0], Extrapolation.CLAMP),
        },
        { rotate: `${rotation}deg` as `${number}deg` },
      ],
    };
  });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      {
        rotateY: `${flipProgress.value * 180}deg` as `${number}deg`,
      },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      {
        rotateY: `${180 + flipProgress.value * 180}deg` as `${number}deg`,
      },
    ],
  }));

  return (
    <Animated.View style={[{ width, height }, issueStyle]}>
      <Animated.View
        pointerEvents={flipped ? "none" : "auto"}
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? "no-hide-descendants" : "auto"}
        style={[styles.face, frontStyle]}
      >
        <TicketFront ticket={ticket} theme={theme} width={width} scene={scene} />

        <Text
          accessible
          accessibilityLabel={frontLabel}
          accessibilityRole="text"
          pointerEvents="none"
          style={styles.a11yOverlay}
        >
          {frontLabel}
        </Text>

        <Pressable
          accessibilityRole="togglebutton"
          accessibilityLabel="티켓 뒷면 상세"
          accessibilityHint="켜면 전체 곡과 계산 상세를 표시합니다."
          accessibilityState={{ checked: false }}
          hitSlop={8}
          onPress={() => setFace(true)}
          style={({ pressed }) => [
            styles.frontFlipButton,
            {
              top: height * 0.68,
              right: Math.max(12, 18 * scale),
              backgroundColor: colors.paper,
              borderColor: colors.border,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[styles.frontFlipButtonText, { color: colors.ink }]}>상세</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={flipped ? "auto" : "none"}
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? "auto" : "no-hide-descendants"}
        style={[styles.face, backStyle]}
      >
        <TicketBack
          ticket={ticket}
          theme={theme}
          width={width}
          onShowFront={() => setFace(false)}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backfaceVisibility: "hidden",
  },
  a11yOverlay: {
    ...StyleSheet.absoluteFill,
    color: "transparent",
    fontSize: 1,
    lineHeight: 1,
  },
  frontFlipButton: {
    position: "absolute",
    zIndex: 1,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
  },
  frontFlipButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
});
