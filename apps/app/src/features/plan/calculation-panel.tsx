import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

import {
  calculatePlan,
  DOMAIN_LIMITS,
  estimateDuration,
  formatMinuteSpan,
  formatWonRange,
  maxAffordablePrefix,
  roundDurationOutward,
  type Plan,
  type PricingConfig,
} from "@singsong/domain";

import {
  AppText,
  Button,
  NumberField,
  RadioGroup,
  Rule,
  parsePositiveInteger,
} from "@/components/ui";
import { useScrollToField } from "@/lib/use-scroll-to-field";
import { radius } from "@/theme/tokens";
import { useAppTheme } from "@/theme/theme-provider";

type FieldName =
  "people" | "singlePrice" | "bundleSongs" | "bundlePrice" | "blockMinutes" | "blockPrice";

type FormErrors = Partial<Record<FieldName, string>> & { form?: string };

export type CalculationPanelHandle = {
  focusFirstInvalid: () => void;
};

function samePricing(left: PricingConfig | null, right: PricingConfig): boolean {
  if (!left || left.kind !== right.kind) return false;
  if (left.kind === "time" && right.kind === "time") {
    return left.blockSeconds === right.blockSeconds && left.blockPriceWon === right.blockPriceWon;
  }
  if (left.kind !== "song" || right.kind !== "song") return false;
  return (
    left.singlePriceWon === right.singlePriceWon &&
    left.bundle?.songs === right.bundle?.songs &&
    left.bundle?.priceWon === right.bundle?.priceWon
  );
}

export const CalculationPanel = forwardRef<
  CalculationPanelHandle,
  {
    plan: Plan;
    disabled: boolean;
    listRef: RefObject<FlatList<Plan["items"][number]> | null>;
    onApply: (people: number, pricing: PricingConfig) => Promise<boolean>;
    onIssue: () => void;
  }
>(function CalculationPanel({ plan, disabled, listRef, onApply, onIssue }, ref) {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<"song" | "time">(plan.pricing?.kind ?? "song");
  const [people, setPeople] = useState(String(plan.people ?? 1));
  const [singlePrice, setSinglePrice] = useState(
    plan.pricing?.kind === "song" ? String(plan.pricing.singlePriceWon) : "",
  );
  const [bundleSongs, setBundleSongs] = useState(
    plan.pricing?.kind === "song" && plan.pricing.bundle ? String(plan.pricing.bundle.songs) : "",
  );
  const [bundlePrice, setBundlePrice] = useState(
    plan.pricing?.kind === "song" && plan.pricing.bundle
      ? String(plan.pricing.bundle.priceWon)
      : "",
  );
  const [blockMinutes, setBlockMinutes] = useState(
    plan.pricing?.kind === "time" ? String(plan.pricing.blockSeconds / 60) : "",
  );
  const [blockPrice, setBlockPrice] = useState(
    plan.pricing?.kind === "time" ? String(plan.pricing.blockPriceWon) : "",
  );
  const [budget, setBudget] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const peopleRef = useRef<TextInput>(null);
  const singlePriceRef = useRef<TextInput>(null);
  const bundleSongsRef = useRef<TextInput>(null);
  const bundlePriceRef = useRef<TextInput>(null);
  const blockMinutesRef = useRef<TextInput>(null);
  const blockPriceRef = useRef<TextInput>(null);
  const scrollToField = useScrollToField(listRef);

  const refs: Record<FieldName, RefObject<TextInput | null>> = {
    people: peopleRef,
    singlePrice: singlePriceRef,
    bundleSongs: bundleSongsRef,
    bundlePrice: bundlePriceRef,
    blockMinutes: blockMinutesRef,
    blockPrice: blockPriceRef,
  };

  function clearErrors(...names: (FieldName | "form")[]) {
    setErrors((current) => {
      const next = { ...current };
      for (const name of names) delete next[name];
      return next;
    });
  }

  function readRequired(
    raw: string,
    name: FieldName,
    label: string,
    maximum: number,
    nextErrors: FormErrors,
  ): number | null {
    const parsed = parsePositiveInteger(raw);
    if (parsed.kind !== "value" || parsed.value > maximum) {
      nextErrors[name] = `${label}은 1–${maximum} 사이의 정수로 입력해 주세요.`;
      return null;
    }
    return parsed.value;
  }

  function validate(): {
    peopleValue: number | null;
    pricing: PricingConfig | null;
    firstInvalid: FieldName | null;
  } {
    const nextErrors: FormErrors = {};
    const peopleValue = readRequired(people, "people", "인원", DOMAIN_LIMITS.maxPeople, nextErrors);
    let pricing: PricingConfig | null = null;

    if (mode === "song") {
      const singlePriceValue = readRequired(
        singlePrice,
        "singlePrice",
        "곡당 가격",
        DOMAIN_LIMITS.maxMoneyWon,
        nextErrors,
      );
      const hasBundle = Boolean(bundleSongs.trim() || bundlePrice.trim());
      let bundle: { readonly songs: number; readonly priceWon: number } | undefined;
      if (hasBundle) {
        const songs = readRequired(
          bundleSongs,
          "bundleSongs",
          "묶음 곡 수",
          DOMAIN_LIMITS.maxTracks,
          nextErrors,
        );
        const priceWon = readRequired(
          bundlePrice,
          "bundlePrice",
          "묶음 가격",
          DOMAIN_LIMITS.maxMoneyWon,
          nextErrors,
        );
        if (songs !== null && priceWon !== null) bundle = { songs, priceWon };
      }
      if (singlePriceValue !== null && (!hasBundle || bundle)) {
        pricing = {
          kind: "song",
          singlePriceWon: singlePriceValue,
          ...(bundle ? { bundle } : {}),
        };
      }
    } else {
      const minutes = readRequired(
        blockMinutes,
        "blockMinutes",
        "시간 단위(분)",
        DOMAIN_LIMITS.maxBlockSeconds / 60,
        nextErrors,
      );
      const priceWon = readRequired(
        blockPrice,
        "blockPrice",
        "시간 단위 가격",
        DOMAIN_LIMITS.maxMoneyWon,
        nextErrors,
      );
      if (minutes !== null && priceWon !== null) {
        pricing = {
          kind: "time",
          blockSeconds: minutes * 60,
          blockPriceWon: priceWon,
        };
      }
    }

    const firstInvalid =
      (Object.keys(nextErrors) as FieldName[]).find((name) => refs[name]) ?? null;
    setErrors(nextErrors);
    return { peopleValue, pricing, firstInvalid };
  }

  function focusFirstInvalid() {
    const result = validate();
    if (result.peopleValue === null || result.pricing === null || result.firstInvalid) {
      if (result.firstInvalid) scrollToField(refs[result.firstInvalid]);
      return;
    }
    if (plan.items.length === 0) return;
    if (plan.people === result.peopleValue && samePricing(plan.pricing, result.pricing)) {
      onIssue();
      return;
    }
    void applyThenIssue(result.peopleValue, result.pricing);
  }

  useImperativeHandle(ref, () => ({ focusFirstInvalid }));

  async function submit() {
    const result = validate();
    if (result.peopleValue === null || result.pricing === null || result.firstInvalid) {
      if (result.firstInvalid) scrollToField(refs[result.firstInvalid]);
      return;
    }
    const saved = await onApply(result.peopleValue, result.pricing);
    if (!saved) setErrors({ form: "가격과 인원을 저장하지 못했습니다. 다시 시도해 주세요." });
  }

  async function applyThenIssue(peopleValue: number, pricing: PricingConfig) {
    const saved = await onApply(peopleValue, pricing);
    if (saved) onIssue();
    else setErrors({ form: "가격과 인원을 저장하지 못했습니다. 다시 시도해 주세요." });
  }

  const duration = useMemo(() => {
    const raw = estimateDuration(plan.items.length);
    return roundDurationOutward(raw);
  }, [plan.items.length]);

  const calculation = useMemo(() => {
    if (plan.items.length === 0 || plan.people === null || plan.pricing === null) {
      return null;
    }
    try {
      return calculatePlan(plan.items.length, plan.pricing, plan.people);
    } catch {
      return null;
    }
  }, [plan.items.length, plan.people, plan.pricing]);

  const budgetMessage = useMemo(() => {
    if (!budget.trim()) return "예산을 입력하면 앞에서부터 부를 수 있는 곡 수를 계산합니다.";
    if (!/^[0-9]+$/u.test(budget.trim())) return "예산은 0 이상의 정수로 입력해 주세요.";
    const amount = Number(budget);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > DOMAIN_LIMITS.maxBudgetWon) {
      return `예산은 0–${DOMAIN_LIMITS.maxBudgetWon}원 사이로 입력해 주세요.`;
    }
    if (!plan.pricing) return "먼저 가격표를 적용해 주세요.";
    const affordable = maxAffordablePrefix(plan.items.length, amount, plan.pricing);
    return affordable.kind === "song"
      ? `앞에서 ${affordable.maxSongs}곡까지 부를 수 있어요.`
      : `앞에서 ${affordable.guaranteedSongs}곡은 확실하고, 최대 ${affordable.possibleSongs}곡까지 가능해요.`;
  }, [budget, plan.items.length, plan.pricing]);

  const canIssue = plan.items.length > 0 && plan.people !== null && plan.pricing !== null;

  return (
    <View style={styles.stack}>
      <View
        style={[styles.panel, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText variant="label">예상 계산</AppText>
            <AppText accessibilityRole="header" variant="title">
              약 {formatMinuteSpan(duration.lowMinutes, duration.highMinutes)}
            </AppText>
          </View>
          <AppText muted>{plan.items.length}곡</AppText>
        </View>
        <Rule />
        {calculation ? (
          <View style={styles.estimateGrid}>
            <Estimate
              label="전체"
              value={formatWonRange(
                calculation.derived.totalLowWon,
                calculation.derived.totalHighWon,
              )}
            />
            <Estimate
              label={`1인 · ${calculation.people}명`}
              value={formatWonRange(
                calculation.derived.perPersonLowWon,
                calculation.derived.perPersonHighWon,
              )}
              accent
            />
          </View>
        ) : (
          <AppText muted>인원과 가격표를 적용하면 비용을 바로 계산합니다.</AppText>
        )}
      </View>

      <View
        style={[styles.panel, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
      >
        <AppText accessibilityRole="header" variant="title">
          인원과 가격표
        </AppText>
        <NumberField
          error={errors.people ?? null}
          inputRef={peopleRef}
          label="인원"
          maxLength={2}
          onChangeText={(value) => {
            setPeople(value);
            clearErrors("people", "form");
          }}
          value={people}
        />
        <RadioGroup
          disabled={disabled}
          label="가격 방식"
          onChange={(value) => {
            setMode(value);
            setErrors({});
          }}
          options={[
            { label: "곡 단위", value: "song" },
            { label: "시간 단위", value: "time" },
          ]}
          value={mode}
        />
        {mode === "song" ? (
          <>
            <NumberField
              error={errors.singlePrice ?? null}
              inputRef={singlePriceRef}
              label="곡당 가격 (원)"
              maxLength={8}
              onChangeText={(value) => {
                setSinglePrice(value);
                clearErrors("singlePrice", "form");
              }}
              value={singlePrice}
            />
            <View style={styles.fields}>
              <NumberField
                error={errors.bundleSongs ?? null}
                inputRef={bundleSongsRef}
                label="묶음 곡 수"
                maxLength={3}
                onChangeText={(value) => {
                  setBundleSongs(value);
                  clearErrors("bundleSongs", "form");
                }}
                optional
                value={bundleSongs}
              />
              <NumberField
                error={errors.bundlePrice ?? null}
                inputRef={bundlePriceRef}
                label="묶음 가격 (원)"
                maxLength={8}
                onChangeText={(value) => {
                  setBundlePrice(value);
                  clearErrors("bundlePrice", "form");
                }}
                optional
                value={bundlePrice}
              />
            </View>
          </>
        ) : (
          <View style={styles.fields}>
            <NumberField
              error={errors.blockMinutes ?? null}
              inputRef={blockMinutesRef}
              label="시간 단위 (분)"
              maxLength={4}
              onChangeText={(value) => {
                setBlockMinutes(value);
                clearErrors("blockMinutes", "form");
              }}
              value={blockMinutes}
            />
            <NumberField
              error={errors.blockPrice ?? null}
              inputRef={blockPriceRef}
              label="단위 가격 (원)"
              maxLength={8}
              onChangeText={(value) => {
                setBlockPrice(value);
                clearErrors("blockPrice", "form");
              }}
              value={blockPrice}
            />
          </View>
        )}
        {errors.form ? (
          <AppText accessibilityRole="alert" style={{ color: colors.danger }}>
            {errors.form}
          </AppText>
        ) : null}
        <Button
          disabled={disabled}
          label={disabled ? "저장 중…" : "가격·인원 적용"}
          onPress={() => void submit()}
        />
      </View>

      <View
        style={[styles.panel, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
      >
        <AppText accessibilityRole="header" variant="title">
          예산 도우미
        </AppText>
        <NumberField
          label="전체 예산 (원)"
          maxLength={9}
          onChangeText={setBudget}
          optional
          value={budget}
        />
        <AppText accessibilityLiveRegion="polite" muted>
          {budgetMessage}
        </AppText>
      </View>

      <View style={styles.issueActions}>
        <Button
          disabled={disabled || plan.items.length === 0}
          label={canIssue ? "티켓 발권하기" : "설정을 마치고 발권하기"}
          onPress={focusFirstInvalid}
        />
      </View>
    </View>
  );
});

function Estimate({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.estimate}>
      <AppText muted variant="caption">
        {label}
      </AppText>
      <AppText style={accent ? { color: colors.moneyText } : undefined} variant="title">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingTop: 18, paddingBottom: 112 },
  panel: {
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 16,
    gap: 14,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingCopy: { flex: 1, gap: 2 },
  estimateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  estimate: { flex: 1, minWidth: 120, gap: 2 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  issueActions: { gap: 8 },
});
