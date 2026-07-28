import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  DOMAIN_LIMITS,
  isValidSearchQuery,
  normalizeSearchText,
  normalizeTrackText,
  unicodeCodePointLength,
  type KaraokeVendor,
} from "@singsong/domain";

import { AppText, Button, RadioGroup, Rule, ScreenHeader, UndoBar } from "@/components/ui";
import { searchTestCatalog, TEST_CATALOG, type CatalogTrack } from "@/features/search/catalog-data";
import { usePlanEditor } from "@/features/plan/use-plan-editor";
import { useA11yAnnounce } from "@/lib/a11y";
import { useToast } from "@/lib/toast";
import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";
import { useAppTheme } from "@/theme/theme-provider";

type ManualDraft = {
  readonly title: string;
  readonly artist: string;
  readonly vendor: KaraokeVendor;
  readonly code: string;
};

class CatalogAddError extends Error {}

const EMPTY_MANUAL: ManualDraft = {
  title: "",
  artist: "",
  vendor: "TJ",
  code: "",
};

export function SearchScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const announce = useA11yAnnounce();
  const { snapshot, plan, store, isSaving, getPlan, mutate } = usePlanEditor();
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<ManualDraft>(EMPTY_MANUAL);
  const [manualError, setManualError] = useState<string | null>(null);
  const [duplicateSignature, setDuplicateSignature] = useState<string | null>(null);
  const duplicateConfirmation = useRef<string | null>(null);
  const [lastAdded, setLastAdded] = useState<CatalogTrack | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const normalized = normalizeSearchText(settledQuery);
  const isSettled = query === settledQuery;
  const queryIsValid = isValidSearchQuery(settledQuery);
  const results = useMemo(
    () =>
      normalized.length === 0
        ? TEST_CATALOG.slice(0, 6)
        : queryIsValid
          ? searchTestCatalog(settledQuery)
          : [],
    [normalized.length, queryIsValid, settledQuery],
  );
  const addedCatalogIds = new Set(plan?.items.flatMap((item) => item.catalogSongId ?? []) ?? []);
  const isFull = (plan?.items.length ?? 0) >= DOMAIN_LIMITS.maxTracks;

  async function addCatalog(track: CatalogTrack) {
    const latest = getPlan();
    if (!latest || !store || latest.items.length >= DOMAIN_LIMITS.maxTracks || isSaving) {
      return;
    }
    if (latest.items.some((item) => item.catalogSongId === track.id)) {
      showToast(`‘${track.title}’은 이미 플랜에 있어요.`);
      return;
    }
    try {
      const next = await mutate((current) => {
        if (current.items.some((item) => item.catalogSongId === track.id)) {
          throw new CatalogAddError(`‘${track.title}’은 이미 플랜에 있어요.`);
        }
        if (current.items.length >= DOMAIN_LIMITS.maxTracks) {
          throw new CatalogAddError("플랜이 가득 찼어요.");
        }
        return {
          items: [
            ...current.items,
            {
              id: store.ports.randomId(),
              source: "catalog",
              catalogSongId: track.id,
              title: normalizeTrackText(track.title),
              artist: normalizeTrackText(track.artist),
              karaokeCodes: Object.entries(track.karaokeCodes)
                .filter(
                  (entry): entry is [KaraokeVendor, string] =>
                    (entry[0] === "TJ" || entry[0] === "KY") && typeof entry[1] === "string",
                )
                .map(([vendor, code]) => ({ vendor, code })),
              order: current.items.length,
            },
          ],
          people: current.people,
          pricing: current.pricing,
        };
      });
      setLastAdded(track);
      announce(`‘${track.title}’, ${next.items.length}번째 곡으로 담았습니다.`);
    } catch (error) {
      showToast(
        error instanceof CatalogAddError
          ? error.message
          : error instanceof Error
            ? error.message
            : "곡을 담지 못했습니다.",
      );
    }
  }

  async function undoCatalogAdd() {
    if (!lastAdded || isSaving) return;
    try {
      await mutate((current) => ({
        items: current.items.filter((item) => item.catalogSongId !== lastAdded.id),
        people: current.people,
        pricing: current.pricing,
      }));
      announce(`‘${lastAdded.title}’ 추가를 되돌렸습니다.`);
      setLastAdded(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "되돌리지 못했습니다.");
    }
  }

  function updateManual<Key extends keyof ManualDraft>(key: Key, value: ManualDraft[Key]) {
    setManual((current) => ({ ...current, [key]: value }));
    setManualError(null);
    if (key === "title" || key === "artist") {
      duplicateConfirmation.current = null;
      setDuplicateSignature(null);
    }
  }

  async function addManual() {
    const latest = getPlan();
    if (!latest || !store || latest.items.length >= DOMAIN_LIMITS.maxTracks || isSaving) {
      return;
    }
    const title = normalizeTrackText(manual.title);
    const artist = normalizeTrackText(manual.artist);
    const code = manual.code.trim();

    if (!title) {
      setManualError("곡 제목을 입력해 주세요.");
      return;
    }
    if (
      unicodeCodePointLength(title) > DOMAIN_LIMITS.maxTextCodePoints ||
      unicodeCodePointLength(artist) > DOMAIN_LIMITS.maxTextCodePoints
    ) {
      setManualError("곡 제목과 가수는 각각 80자 이내로 입력해 주세요.");
      return;
    }
    if (code && !/^[0-9]{1,6}$/u.test(code)) {
      setManualError("노래방 번호는 숫자 1–6자리로 입력해 주세요.");
      return;
    }

    const signature = `${normalizeSearchText(title)}\u0000${normalizeSearchText(artist)}`;
    const duplicate = latest.items.some(
      (item) =>
        normalizeSearchText(item.title) === normalizeSearchText(title) &&
        normalizeSearchText(item.artist) === normalizeSearchText(artist),
    );
    const confirmedDuplicate = duplicate && duplicateConfirmation.current === signature;
    if (duplicate && !confirmedDuplicate) {
      duplicateConfirmation.current = signature;
      setDuplicateSignature(signature);
      setManualError(
        "같은 제목과 가수의 곡이 이미 있습니다. 별도 곡으로 담으려면 한 번 더 눌러 주세요.",
      );
      return;
    }
    if (confirmedDuplicate) duplicateConfirmation.current = null;

    try {
      const next = await mutate((current) => {
        const duplicateAtCommit = current.items.some(
          (item) =>
            normalizeSearchText(item.title) === normalizeSearchText(title) &&
            normalizeSearchText(item.artist) === normalizeSearchText(artist),
        );
        if (duplicateAtCommit && !confirmedDuplicate) {
          throw new CatalogAddError(
            "같은 제목과 가수의 곡이 이미 있습니다. 별도 곡으로 담으려면 한 번 더 눌러 주세요.",
          );
        }
        if (current.items.length >= DOMAIN_LIMITS.maxTracks) {
          throw new CatalogAddError("플랜이 가득 찼어요.");
        }
        return {
          items: [
            ...current.items,
            {
              id: store.ports.randomId(),
              source: "manual",
              catalogSongId: null,
              title,
              artist,
              karaokeCodes: code ? [{ vendor: manual.vendor, code }] : [],
              order: current.items.length,
            },
          ],
          people: current.people,
          pricing: current.pricing,
        };
      });
      setManual(EMPTY_MANUAL);
      setManualError(null);
      setDuplicateSignature(null);
      duplicateConfirmation.current = null;
      setManualOpen(false);
      setLastAdded(null);
      announce(`‘${title}’, ${next.items.length}번째 곡으로 직접 담았습니다.`);
    } catch (error) {
      if (error instanceof CatalogAddError) {
        duplicateConfirmation.current = signature;
        setDuplicateSignature(signature);
        setManualError(error.message);
      } else {
        showToast(error instanceof Error ? error.message : "곡을 담지 못했습니다.");
      }
    }
  }

  const statusMessage = !isSettled
    ? "입력이 끝나면 찾기 시작합니다."
    : normalized.length === 0
      ? "가상 목록에서 골라 보세요."
      : !queryIsValid
        ? /^[0-9]+$/u.test(normalized)
          ? "번호는 6자리 이내로 입력해 주세요."
          : "제목·가수·초성은 두 글자 이상 입력해 주세요."
        : results.length === 0
          ? "일치하는 테스트 곡이 없습니다."
          : `${results.length}곡을 찾았습니다.`;

  if (snapshot.status === "error") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.recovery}>
          <AppText accessibilityRole="header" variant="title">
            곡 목록을 열지 못했습니다.
          </AppText>
          <AppText muted>{snapshot.error.message}</AppText>
          <Button label="닫기" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      <KeyboardAvoidingView automaticOffset behavior="padding" style={styles.keyboard}>
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <ScreenHeader
                eyebrow="곡 담기"
                title="무엇을 부를까요?"
                subtitle="제목·가수·초성 또는 TJ·KY 번호로 찾아보세요."
                status={null}
                action={<Button compact kind="quiet" label="닫기" onPress={() => router.back()} />}
              />
              <View
                style={[
                  styles.testData,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle },
                ]}
              >
                <AppText variant="label">TEST DATA</AppText>
                <AppText muted variant="caption">
                  권리 검증용 허구의 로컬 곡 목록입니다.
                </AppText>
              </View>
              <TextInput
                accessibilityLabel="곡 제목, 가수, 초성 또는 노래방 번호 검색"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                enterKeyHint="search"
                maxLength={120}
                onChangeText={setQuery}
                placeholder="예: 마지막 환승, ㅁㅈㅁ ㅎㅅ, 91003"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="search"
                selectionColor={colors.accentText}
                style={[
                  styles.searchInput,
                  {
                    color: colors.ink,
                    backgroundColor: colors.paper,
                    borderColor: colors.borderControl,
                  },
                ]}
                value={query}
              />
              <AppText
                accessibilityLiveRegion="polite"
                muted={queryIsValid || normalized.length === 0}
                style={
                  !queryIsValid && normalized.length > 0 && isSettled
                    ? { color: colors.danger }
                    : undefined
                }
                variant="caption"
              >
                {statusMessage}
              </AppText>
              <Rule />
              <AppText variant="label">
                {normalized.length === 0 ? "먼저 불러볼 곡" : "검색 결과"}
              </AppText>
            </View>
          }
          renderItem={({ item, index }) => {
            const added = addedCatalogIds.has(item.id);
            const codes = Object.entries(item.karaokeCodes)
              .map(([vendor, code]) => `${vendor} ${code}`)
              .join(" · ");
            return (
              <View
                style={[
                  styles.result,
                  { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
                ]}
              >
                <AppText muted variant="label">
                  {String(index + 1).padStart(2, "0")}
                </AppText>
                <View style={styles.resultCopy}>
                  <AppText variant="title">{item.title}</AppText>
                  <AppText muted>{item.artist}</AppText>
                  {codes ? (
                    <AppText muted variant="caption">
                      {codes}
                    </AppText>
                  ) : null}
                </View>
                <Button
                  accessibilityLabel={`${item.title}, ${item.artist} ${added ? "담김" : "담기"}`}
                  compact
                  disabled={added || isFull || isSaving || snapshot.status !== "ready"}
                  kind={added ? "quiet" : "secondary"}
                  label={added ? "담김" : "담기"}
                  onPress={() => void addCatalog(item)}
                />
              </View>
            );
          }}
          ItemSeparatorComponent={SearchResultSeparator}
          ListEmptyComponent={
            normalized.length > 0 && queryIsValid && isSettled ? (
              <View style={styles.noResults}>
                <AppText variant="title">찾는 곡이 안 보여요.</AppText>
                <AppText muted>다른 표기나 번호로 찾거나 직접 입력해 보세요.</AppText>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {lastAdded && addedCatalogIds.has(lastAdded.id) ? (
                <UndoBar
                  disabled={isSaving}
                  message={`‘${lastAdded.title}’을 담았습니다.`}
                  onAction={() => void undoCatalogAdd()}
                />
              ) : null}
              <Button
                kind="secondary"
                label={manualOpen ? "직접 입력 닫기" : "목록에 없나요? 직접 입력"}
                onPress={() => {
                  setManualOpen((open) => !open);
                  setManualError(null);
                }}
              />
              {manualOpen ? (
                <View
                  style={[
                    styles.manual,
                    { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
                  ]}
                >
                  <AppText accessibilityRole="header" variant="title">
                    곡 직접 입력
                  </AppText>
                  <LabeledInput
                    label="곡 제목"
                    value={manual.title}
                    onChangeText={(value) => updateManual("title", value)}
                    placeholder="필수"
                    colors={colors}
                  />
                  <LabeledInput
                    label="가수"
                    value={manual.artist}
                    onChangeText={(value) => updateManual("artist", value)}
                    placeholder="선택"
                    colors={colors}
                  />
                  <RadioGroup
                    label="노래방 번호 회사"
                    value={manual.vendor}
                    options={[
                      { label: "TJ", value: "TJ" },
                      { label: "KY", value: "KY" },
                    ]}
                    onChange={(value) => updateManual("vendor", value)}
                  />
                  <LabeledInput
                    label="노래방 번호 (선택)"
                    value={manual.code}
                    onChangeText={(value) => updateManual("code", value)}
                    placeholder="숫자 1–6자리"
                    colors={colors}
                    numeric
                  />
                  {manualError ? (
                    <AppText
                      accessibilityLiveRegion="assertive"
                      accessibilityRole="alert"
                      style={{ color: colors.danger }}
                    >
                      {manualError}
                    </AppText>
                  ) : null}
                  <Button
                    disabled={isFull || isSaving || snapshot.status !== "ready"}
                    label={duplicateSignature ? "그래도 별도 곡으로 담기" : "플랜에 담기"}
                    onPress={() => void addManual()}
                  />
                </View>
              ) : null}
              {isFull ? (
                <AppText style={{ color: colors.danger }}>
                  플랜에는 최대 {DOMAIN_LIMITS.maxTracks}곡까지 담을 수 있습니다.
                </AppText>
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SearchResultSeparator() {
  return <View style={styles.separator} />;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  numeric?: boolean;
}) {
  return (
    <View style={styles.labeledInput}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        inputMode={numeric ? "numeric" : "text"}
        keyboardType={numeric ? "number-pad" : "default"}
        maxLength={numeric ? 6 : 160}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.accentText}
        style={[
          styles.manualInput,
          {
            color: colors.ink,
            backgroundColor: colors.canvas,
            borderColor: colors.borderControl,
          },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  recovery: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  headerStack: { gap: 12, marginBottom: 14 },
  testData: {
    borderWidth: 1,
    borderRadius: radius.control,
    padding: 10,
    gap: 2,
  },
  searchInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: radius.action,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  result: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultCopy: { flex: 1, gap: 1 },
  separator: { height: 8 },
  noResults: { paddingVertical: 28, gap: 8 },
  footer: { gap: 12, paddingTop: 18 },
  manual: {
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 16,
    gap: 14,
  },
  labeledInput: { gap: 6 },
  manualInput: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
