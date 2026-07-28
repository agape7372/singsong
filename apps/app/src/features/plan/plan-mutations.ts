import type { Plan, Track } from "@singsong/domain";

import type { PlanDraft } from "@/features/plan/use-plan-editor";

function retainSettings(current: Plan, items: readonly Track[]): PlanDraft {
  return { items, people: current.people, pricing: current.pricing };
}

export function moveTrack(current: Plan, trackId: string, direction: -1 | 1): PlanDraft {
  const index = current.items.findIndex((item) => item.id === trackId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= current.items.length) {
    return retainSettings(current, current.items);
  }
  const items = [...current.items];
  const first = items[index];
  const second = items[target];
  if (!first || !second) return retainSettings(current, items);
  items[index] = second;
  items[target] = first;
  return retainSettings(current, items);
}

export function removeTrack(current: Plan, trackId: string): PlanDraft {
  return retainSettings(
    current,
    current.items.filter((item) => item.id !== trackId),
  );
}

export function restoreTrack(current: Plan, track: Track, originalIndex: number): PlanDraft {
  if (current.items.some((item) => item.id === track.id)) {
    return retainSettings(current, current.items);
  }
  const items = [...current.items];
  items.splice(Math.min(Math.max(0, originalIndex), items.length), 0, track);
  return retainSettings(current, items);
}
