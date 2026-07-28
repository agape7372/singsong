const configuredShareOrigin = process.env.EXPO_PUBLIC_SHARE_API_ORIGIN?.trim() ?? "";

function normalizeHttpOrigin(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** EAS/로컬 환경이 주입하는 공유 API와 랜딩의 같은 origin. 번들에 비밀값을 넣지 않는다. */
export const SHARE_API_ORIGIN = normalizeHttpOrigin(configuredShareOrigin);

export function requireShareApiOrigin(): string {
  if (!SHARE_API_ORIGIN) {
    throw new Error(
      "공유 서버 주소가 설정되지 않았습니다. EXPO_PUBLIC_SHARE_API_ORIGIN을 확인해 주세요.",
    );
  }
  return SHARE_API_ORIGIN;
}

export function shareApiUrl(pathname: string): string {
  return new URL(pathname, requireShareApiOrigin()).toString();
}
