import { isValidShareSlug } from "@singsong/domain";

function importPath(slug: string): string {
  return `/import?slug=${encodeURIComponent(slug)}`;
}

/**
 * custom scheme과 HTTPS 공유 링크를 앱 내부 import 화면 하나로 정규화한다.
 * 해석하지 못한 외부 입력은 홈으로 보내 URI가 라우터 경로로 그대로 노출되지 않게 한다.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, "singsong://app");
    const segments = url.pathname.split("/").filter(Boolean);
    const customSchemePath =
      url.protocol === "singsong:" && url.hostname === "s" && segments.length === 1;
    const regularSharePath = segments.length === 2 && segments[0] === "s";
    const slug = customSchemePath ? segments[0] : regularSharePath ? segments[1] : null;
    return slug && isValidShareSlug(slug) ? importPath(slug) : "/";
  } catch {
    return "/";
  }
}
