import { useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DOMAIN_LIMITS, normalizeTrackText, type Track } from "@singsong/domain";

import { usePlanEditor } from "@/features/plan/use-plan-editor";
import { TEST_CATALOG, type CatalogTrack } from "@/features/search/catalog-data";
import { useAppTheme } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";

type Playlist = {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly tracks: readonly CatalogTrack[];
};

class PlaylistNoopError extends Error {}

const PLAYLISTS: readonly Playlist[] = [
  {
    id: "night",
    title: "새벽 감성 체크인",
    blurb: "조명 낮추고 천천히 시작하는 6곡",
    tracks: TEST_CATALOG.slice(0, 6),
  },
  {
    id: "encore",
    title: "한 곡 더 앙코르",
    blurb: "마이크를 넘기며 같이 부르는 6곡",
    tracks: TEST_CATALOG.slice(6, 12),
  },
  {
    id: "high-note",
    title: "고음 계단 정복",
    blurb: "목 풀고 한 칸씩 올라가는 6곡",
    tracks: TEST_CATALOG.slice(12, 18),
  },
  {
    id: "duet",
    title: "둘이 부르면 완성",
    blurb: "호흡을 맞춰 주고받는 6곡",
    tracks: TEST_CATALOG.slice(18, 24),
  },
  {
    id: "mood-turn",
    title: "분위기 반전 버튼",
    blurb: "텐션을 단숨에 바꾸는 6곡",
    tracks: TEST_CATALOG.slice(24, 30),
  },
  {
    id: "last",
    title: "오늘의 마지막 하이라이트",
    blurb: "끝나기 전 한 번 더 모이는 6곡",
    tracks: TEST_CATALOG.slice(30, 36),
  },
] as const;

function karaokeCodes(track: CatalogTrack) {
  return (["TJ", "KY"] as const).flatMap((vendor) => {
    const code = track.karaokeCodes[vendor];
    return code ? [{ vendor, code }] : [];
  });
}

export function DiscoverScreen() {
  const { plan, store, mutate, isSaving } = usePlanEditor();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<string | null>(null);

  async function addPlaylist(playlist: Playlist) {
    if (!plan || !store || isSaving) return;
    let outcome = { added: 0, duplicate: 0, full: 0 };

    try {
      await mutate((current) => {
        const existing = new Set(current.items.flatMap((item) => item.catalogSongId ?? []));
        const items: Track[] = [...current.items];
        const nextOutcome = { added: 0, duplicate: 0, full: 0 };
        for (const track of playlist.tracks) {
          if (existing.has(track.id)) {
            nextOutcome.duplicate += 1;
            continue;
          }
          if (items.length >= DOMAIN_LIMITS.maxTracks) {
            nextOutcome.full += 1;
            continue;
          }
          existing.add(track.id);
          items.push({
            id: store.ports.randomId(),
            source: "catalog",
            catalogSongId: track.id,
            title: normalizeTrackText(track.title),
            artist: normalizeTrackText(track.artist),
            karaokeCodes: karaokeCodes(track),
            order: items.length,
          });
          nextOutcome.added += 1;
        }
        outcome = nextOutcome;
        if (nextOutcome.added === 0) throw new PlaylistNoopError();
        return { items, people: current.people, pricing: current.pricing };
      });
    } catch (error) {
      if (error instanceof PlaylistNoopError) {
        // 아래 공통 결과 문구가 duplicate/full의 정확한 이유를 설명한다.
      } else {
        const message = "셋리스트를 담지 못했어요. 잠시 후 다시 시도해 주세요.";
        setStatus(message);
        AccessibilityInfo.announceForAccessibility(message);
        return;
      }
    }

    const message =
      outcome.added > 0
        ? `${playlist.title}에서 ${outcome.added}곡을 담았어요.${outcome.duplicate ? ` 이미 담긴 ${outcome.duplicate}곡은 건너뛰었어요.` : ""}${outcome.full ? ` 플랜이 가득 차 ${outcome.full}곡은 담지 못했어요.` : ""}`
        : outcome.duplicate > 0
          ? "이 셋리스트의 곡은 이미 모두 담겨 있어요."
          : "플랜이 가득 찼어요.";
    setStatus(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText }]}>TEST DATA CURATION</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            발견
          </Text>
          <Text style={[styles.help, { color: colors.inkMuted }]}>
            실제 가수나 권리 카탈로그가 아닌, 흐름 검증용 가상 셋리스트입니다.
          </Text>
        </View>

        {PLAYLISTS.map((playlist, index) => (
          <View
            key={playlist.id}
            style={[
              styles.card,
              { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.cardHead}>
              <Text style={[styles.number, { color: colors.accentText }]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={styles.copy}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>{playlist.title}</Text>
                <Text style={[styles.help, { color: colors.inkMuted }]}>{playlist.blurb}</Text>
              </View>
            </View>
            <View style={styles.trackChips}>
              {playlist.tracks.map((track) => (
                <Text
                  key={track.id}
                  style={[
                    styles.chip,
                    { color: colors.inkMuted, backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  {track.title}
                </Text>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${playlist.title} ${playlist.tracks.length}곡 플랜에 담기`}
              disabled={!plan || !store || isSaving}
              onPress={() => void addPlaylist(playlist)}
              style={[
                styles.button,
                { borderColor: colors.borderControl, opacity: isSaving ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: colors.ink, fontWeight: "800" }}>
                {playlist.tracks.length}곡 플랜에 담기
              </Text>
            </Pressable>
          </View>
        ))}

        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.inkMuted }]}>
          {status}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 20, paddingBottom: 40, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: "900", marginTop: 2 },
  help: { fontSize: 14, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: radius.strip, padding: 16, gap: 14 },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  number: { width: 30, fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  copy: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 19, fontWeight: "900" },
  trackChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { minHeight: 22, fontSize: 13, lineHeight: 20 },
});
