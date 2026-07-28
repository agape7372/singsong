import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/theme-provider";

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]}>이 화면을 찾을 수 없어요.</Text>
        <Link href="/" style={[styles.link, { color: colors.accentText }]}>
          플랜으로 돌아가기
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 24 },
  title: { fontSize: 20, fontWeight: "700" },
  link: { minHeight: 48, paddingVertical: 14, fontSize: 16, fontWeight: "700" },
});
