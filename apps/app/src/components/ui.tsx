import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";

import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";
import { useAppTheme } from "@/theme/theme-provider";

type TextVariant = "body" | "caption" | "label" | "title" | "display";

export function AppText({
  variant = "body",
  muted = false,
  style,
  ...props
}: TextProps & { variant?: TextVariant; muted?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Text
      {...props}
      style={[textStyles[variant], { color: muted ? colors.inkMuted : colors.ink }, style]}
    />
  );
}

type ButtonKind = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  label,
  kind = "primary",
  compact = false,
  disabled,
  style,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  kind?: ButtonKind;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  const foreground =
    kind === "primary" ? colors.onAccent : kind === "danger" ? colors.danger : colors.ink;
  const background =
    kind === "primary"
      ? colors.accentFill
      : kind === "secondary"
        ? colors.surfaceMuted
        : "transparent";
  const borderColor =
    kind === "quiet" ? "transparent" : kind === "danger" ? colors.danger : colors.borderControl;

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: background,
          borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  status = "이 기기에 자동 저장",
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: string | null;
  action?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          {eyebrow ? <AppText variant="label">{eyebrow}</AppText> : null}
          <AppText accessibilityRole="header" variant="display">
            {title}
          </AppText>
        </View>
        {action}
      </View>
      {subtitle ? <AppText muted>{subtitle}</AppText> : null}
      {status ? (
        <View
          accessibilityLabel={status}
          style={[styles.status, { backgroundColor: colors.surfaceMuted }]}
        >
          <View style={[styles.statusDot, { backgroundColor: colors.accentText }]} />
          <AppText muted variant="caption">
            {status}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function Rule() {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityElementsHidden
      style={[styles.rule, { backgroundColor: colors.borderSubtle }]}
    />
  );
}

export function PerforationRule() {
  const { colors } = useAppTheme();
  return (
    <View accessibilityElementsHidden style={styles.perforation}>
      {Array.from({ length: 16 }, (_, index) => (
        <View
          key={index}
          style={[styles.perforationDash, { backgroundColor: colors.borderSubtle }]}
        />
      ))}
    </View>
  );
}

export function QueueIndex({ value }: { value: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityElementsHidden
      style={[styles.queueIndex, { borderColor: colors.borderSubtle }]}
    >
      <AppText variant="label">{String(value).padStart(2, "0")}</AppText>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.empty, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
    >
      <AppText accessibilityRole="header" variant="title">
        {title}
      </AppText>
      <AppText muted>{description}</AppText>
      {action}
    </View>
  );
}

export function RadioGroup<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: Value;
  options: readonly { label: string; value: Value }[];
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.radioGroup}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.radio,
              {
                borderColor: selected ? colors.accentText : colors.borderControl,
                backgroundColor: selected ? colors.surfaceMuted : colors.paper,
                opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.radioDot,
                {
                  borderColor: selected ? colors.accentText : colors.borderControl,
                  backgroundColor: selected ? colors.accentText : "transparent",
                },
              ]}
            />
            <AppText variant="label">{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export type NumberFieldState =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid" }
  | { readonly kind: "value"; readonly value: number };

export function parsePositiveInteger(raw: string): NumberFieldState {
  if (!raw.trim()) return { kind: "empty" };
  if (!/^[0-9]+$/u.test(raw.trim())) return { kind: "invalid" };
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? { kind: "value", value } : { kind: "invalid" };
}

export function NumberField({
  label,
  value,
  onChangeText,
  error,
  optional = false,
  inputRef,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText" | "ref"> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  optional?: boolean;
  inputRef?: React.Ref<TextInput>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label">
        {label}
        {optional ? " (선택)" : ""}
      </AppText>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error ?? props.accessibilityHint}
        keyboardType="number-pad"
        inputMode="numeric"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.accentText}
        style={[
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.paper,
            borderColor: error ? colors.danger : colors.borderControl,
          },
        ]}
      />
      {error ? (
        <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function UndoBar({
  message,
  actionLabel = "되돌리기",
  onAction,
  disabled = false,
}: {
  message: string;
  actionLabel?: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.undo, { backgroundColor: colors.ink }]}>
      <Text style={[styles.undoMessage, { color: colors.paper }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onAction}
        style={styles.undoAction}
      >
        <Text style={[styles.undoActionLabel, { color: colors.accentFill }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            { backgroundColor: colors.paper, borderColor: colors.borderSubtle },
          ]}
        >
          <AppText accessibilityRole="header" variant="title">
            {title}
          </AppText>
          <AppText muted>{description}</AppText>
          <View style={styles.dialogActions}>
            <Button label="취소" kind="secondary" onPress={onCancel} style={styles.dialogButton} />
            <Button
              label={confirmLabel}
              kind={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              style={styles.dialogButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const textStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  title: { fontSize: 20, lineHeight: 27, fontWeight: "800", letterSpacing: -0.3 },
  display: { fontSize: 30, lineHeight: 38, fontWeight: "900", letterSpacing: -0.8 },
});

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.action,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCompact: { paddingHorizontal: 12 },
  buttonLabel: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  header: { gap: 8, paddingBottom: 8 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1, gap: 2 },
  status: {
    alignSelf: "flex-start",
    minHeight: 28,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  rule: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  perforation: { flexDirection: "row", justifyContent: "space-between", overflow: "hidden" },
  perforationDash: { width: 12, height: 1 },
  queueIndex: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 20,
    gap: 12,
  },
  radioGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  radio: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.action,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  radioDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  field: { flex: 1, minWidth: 120, gap: 6 },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  undo: {
    minHeight: 56,
    borderRadius: radius.action,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  undoMessage: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  undoAction: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  undoActionLabel: { fontSize: 14, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radius.strip,
    padding: 20,
    gap: 14,
  },
  dialogActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  dialogButton: { flex: 1 },
});
