import { File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  clearProfilePhoto,
  DEFAULT_PROFILE_COLOR,
  deleteAllLocalData,
  saveProfile,
} from "@singsong/store";

import { useNativeStore, type NativeStoreSnapshot } from "@/store/store-provider";
import { useAppTheme, type AppColors } from "@/theme/theme-provider";
import { MIN_TOUCH_TARGET, radius } from "@/theme/tokens";

const PROFILE_PHOTO = new File(Paths.document, "singsong-profile-photo.jpg");
const PROFILE_COLORS = [
  { id: "rose", label: "로즈", chip: "#C9295A" },
  { id: "ochre", label: "오커", chip: "#8A5200" },
  { id: "plum", label: "플럼", chip: "#6E3B73" },
  { id: "teal", label: "틸", chip: "#1F6259" },
  { id: "clay", label: "클레이", chip: "#A6482A" },
  { id: "ink", label: "잉크", chip: "#3A3340" },
] as const;

async function removeProfileFile() {
  if (PROFILE_PHOTO.exists) PROFILE_PHOTO.delete();
}

export function SettingsScreen() {
  const native = useNativeStore();
  const { colors } = useAppTheme();

  if (native.status === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accentText} />
      </SafeAreaView>
    );
  }
  if (native.status === "error") {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: colors.ink }}>로컬 저장소를 열지 못했어요.</Text>
      </SafeAreaView>
    );
  }
  return <ReadySettingsScreen native={native} colors={colors} />;
}

function ReadySettingsScreen({
  native,
  colors,
}: {
  native: Extract<NativeStoreSnapshot, { status: "ready" }>;
  colors: AppColors;
}) {
  const [nickname, setNickname] = useState(native.profile.nickname);
  const [colorId, setColorId] = useState(native.profile.colorId);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function announce(message: string) {
    setStatus(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function persistProfile() {
    if (busy) return;
    const nextNickname = nickname.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (Array.from(nextNickname).length > 30) {
      announce("닉네임은 30자 이내로 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile(native.store, { nickname: nextNickname, colorId });
      announce("프로필을 저장했어요.");
    } catch {
      announce("프로필을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePhoto() {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    const picked = result.assets?.[0];
    if (result.canceled || !picked) return;
    setBusy(true);
    try {
      const resized = await manipulateAsync(picked.uri, [{ resize: { width: 512, height: 512 } }], {
        compress: 0.86,
        format: SaveFormat.JPEG,
      });
      await new File(resized.uri).copy(PROFILE_PHOTO, { overwrite: true });
      await saveProfile(native.store, { photoUri: PROFILE_PHOTO.uri });
      announce("프로필 사진을 저장했어요.");
    } catch {
      announce("프로필 사진을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (busy) return;
    setBusy(true);
    try {
      await clearProfilePhoto(native.store);
      await removeProfileFile();
      announce("프로필 사진을 지웠어요.");
    } catch {
      announce("프로필 사진을 지우지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function checkUpdate() {
    if (busy) return;
    if (!Updates.isEnabled) {
      announce("개발 빌드에서는 업데이트 확인을 사용할 수 없어요.");
      return;
    }
    setBusy(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        announce("이미 최신 버전이에요.");
        return;
      }
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        announce("업데이트를 받았어요. 앱을 다시 시작합니다.");
        await Updates.reloadAsync();
      } else {
        announce("업데이트를 받지 못했어요.");
      }
    } catch {
      announce("업데이트를 확인하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteAll() {
    if (busy) return;
    Alert.alert(
      "이 기기의 데이터를 모두 지울까요?",
      "플랜, 티켓, 가져온 링크와 프로필이 삭제되며 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "모두 삭제",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void deleteAllLocalData(native.store)
              .then(() => removeProfileFile())
              .then(() => {
                setNickname("");
                setColorId(DEFAULT_PROFILE_COLOR);
                announce("이 기기의 싱송 데이터를 모두 지웠어요.");
              })
              .catch(() => announce("데이터를 모두 지우지 못했어요."))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText }]}>MY STATION</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            설정
          </Text>
          <Text style={[styles.saved, { color: colors.inkMuted }]}>이 기기에 자동 저장됩니다.</Text>
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>프로필</Text>
          <View style={styles.photoRow}>
            {native.profile.photoUri ? (
              <Image
                alt="프로필 사진"
                source={{ uri: native.profile.photoUri }}
                style={styles.photo}
              />
            ) : (
              <View
                style={[styles.photo, styles.photoEmpty, { backgroundColor: colors.surfaceMuted }]}
              >
                <Text style={{ color: colors.inkMuted }}>사진</Text>
              </View>
            )}
            <View style={styles.photoActions}>
              <SecondaryAction
                label="사진 고르기"
                onPress={() => void choosePhoto()}
                colors={colors}
              />
              {native.profile.photoUri ? (
                <SecondaryAction
                  label="사진 지우기"
                  onPress={() => void removePhoto()}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>
          <Text nativeID="profile-nickname-label" style={[styles.label, { color: colors.ink }]}>
            닉네임
          </Text>
          <TextInput
            accessibilityLabel="닉네임"
            accessibilityLabelledBy="profile-nickname-label"
            value={nickname}
            onChangeText={setNickname}
            maxLength={60}
            placeholder="선택 사항"
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              {
                color: colors.ink,
                borderColor: colors.borderControl,
                backgroundColor: colors.canvas,
              },
            ]}
          />
          <Text style={[styles.label, { color: colors.ink }]}>프로필 색상</Text>
          <View accessibilityRole="radiogroup" style={styles.colorRow}>
            {PROFILE_COLORS.map((value) => (
              <Pressable
                key={value.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: colorId === value.id }}
                accessibilityLabel={`${value.label} 색상`}
                onPress={() => setColorId(value.id)}
                style={[
                  styles.colorChoice,
                  {
                    borderColor: colorId === value.id ? colors.accentFill : colors.borderControl,
                    backgroundColor: value.chip,
                  },
                ]}
              >
                <Text style={styles.colorLabel}>{value.label}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryAction
            label={busy ? "저장 중…" : "프로필 저장"}
            onPress={() => void persistProfile()}
            disabled={busy}
            colors={colors}
          />
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>앱</Text>
          <Text style={[styles.help, { color: colors.inkMuted }]}>
            새 버전은 안전한 런타임 지문과 같은 채널에서만 적용됩니다.
          </Text>
          <SecondaryAction
            label="업데이트 확인"
            onPress={() => void checkUpdate()}
            colors={colors}
          />
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>데이터와 개인정보</Text>
          <Text style={[styles.help, { color: colors.inkMuted }]}>
            플랜과 사진은 이 앱의 로컬 저장소에 보관됩니다. 공유 링크를 만든 경우 링크 만료 전까지
            서버 사본은 별도로 남을 수 있습니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={confirmDeleteAll}
            disabled={busy}
            style={[styles.danger, { borderColor: colors.accentText }]}
          >
            <Text style={{ color: colors.accentText, fontWeight: "800" }}>
              이 기기의 데이터 모두 삭제
            </Text>
          </Pressable>
        </View>

        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.inkMuted }]}>
          {status}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecondaryAction({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: AppColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.secondary, { borderColor: colors.borderControl }]}
    >
      <Text style={{ color: colors.ink, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function PrimaryAction({
  label,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  colors: AppColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, { backgroundColor: colors.accentFill, opacity: disabled ? 0.55 : 1 }]}
    >
      <Text style={{ color: colors.onAccent, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 20, paddingBottom: 40, gap: 16 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: "800", marginTop: 2 },
  saved: { fontSize: 13, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: radius.strip, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 76, height: 76, borderRadius: 38 },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  photoActions: { flex: 1, gap: 8 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  input: { minHeight: MIN_TOUCH_TARGET, borderWidth: 1, borderRadius: radius.control, padding: 12 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorChoice: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 2,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  colorLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondary: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  help: { fontSize: 14, lineHeight: 21 },
  danger: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.action,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  status: { minHeight: 22, fontSize: 13, lineHeight: 20 },
});
