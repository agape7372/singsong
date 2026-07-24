import { getActivePlan, mutateActivePlan } from "@/data/plan-database";
import { normalizeTrackText } from "@/domain/validation";
import type { Track } from "@/domain/models";
import type { CatalogTrack } from "@/features/catalog/types";

export type AddTracksResult = {
  added: number;
  skippedDuplicate: number;
  skippedFull: number;
};

const MAX_TRACKS = 100;

function toKaraokeCodes(catalog: CatalogTrack) {
  return Object.entries(catalog.karaokeCodes)
    .filter(
      (entry): entry is ["TJ" | "KY", string] =>
        (entry[0] === "TJ" || entry[0] === "KY") && Boolean(entry[1]),
    )
    .map(([vendor, code]) => ({ vendor, code }));
}

/**
 * Appends catalog tracks to the active plan, skipping duplicates (by catalog id)
 * and anything beyond the 100-track limit. Used by 발견 to add curated songs.
 */
export async function addCatalogTracks(catalog: readonly CatalogTrack[]): Promise<AddTracksResult> {
  const plan = await getActivePlan();
  const existing = new Set(plan.items.flatMap((item) => item.catalogSongId ?? []));
  let skippedDuplicate = 0;
  let skippedFull = 0;
  const additions: Track[] = [];

  for (const track of catalog) {
    if (existing.has(track.id)) {
      skippedDuplicate += 1;
      continue;
    }
    if (plan.items.length + additions.length >= MAX_TRACKS) {
      skippedFull += 1;
      continue;
    }
    existing.add(track.id);
    additions.push({
      id: crypto.randomUUID(),
      source: "catalog",
      catalogSongId: track.id,
      title: normalizeTrackText(track.title),
      artist: normalizeTrackText(track.artist),
      karaokeCodes: toKaraokeCodes(track),
      order: plan.items.length + additions.length,
    });
  }

  if (additions.length > 0) {
    await mutateActivePlan(plan.revision, (current) => ({
      items: [...current.items, ...additions],
      people: current.people,
      pricing: current.pricing,
    }));
  }

  return { added: additions.length, skippedDuplicate, skippedFull };
}
