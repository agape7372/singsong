import { Canvas, Picture } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { View } from "react-native";

import type { TicketSnapshot } from "@singsong/domain";
import { buildTicketScene, type Theme, type TicketScene } from "@singsong/ticket-art";

import { recordTicketScene } from "@/render/skia";
import { ticketModelFromSnapshot } from "@/render/skia/export-ticket";

export const TICKET_ASPECT_RATIO = 4 / 5;

export function buildTicketCardScene(ticket: TicketSnapshot, theme: Theme, width: number) {
  return buildTicketScene(ticketModelFromSnapshot(ticket), {
    width,
    height: width / TICKET_ASPECT_RATIO,
    variant: "card",
    theme,
  });
}

/**
 * Skia has no semantic text nodes. Keep its accessible equivalent mechanically
 * tied to the canonical display list: ordinary text reads itself, while an
 * explicit `announce` value replaces visual shorthand such as the large count.
 */
export function ticketSceneAccessibilityLabel(scene: TicketScene) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const primitive of scene.primitives) {
    const label =
      primitive.kind === "text"
        ? (primitive.announce ?? primitive.text)
        : primitive.kind === "halftoneGlyphs"
          ? primitive.announce
          : undefined;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels.join(". ");
}

export function TicketFront({
  ticket,
  theme,
  width,
  scene: providedScene,
}: {
  ticket: TicketSnapshot;
  theme: Theme;
  width: number;
  scene?: TicketScene;
}) {
  const height = width / TICKET_ASPECT_RATIO;
  const scene = useMemo(
    () => providedScene ?? buildTicketCardScene(ticket, theme, width),
    [providedScene, theme, ticket, width],
  );
  const picture = useMemo(() => recordTicketScene(scene), [scene]);

  useEffect(() => () => picture.dispose(), [picture]);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Canvas style={{ width, height }} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
