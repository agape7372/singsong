import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("release security contracts", () => {
  it("keeps browser roles away from private tables and allows only exact RPC functions", () => {
    const sql = read("supabase/migrations/20260722010000_share_snapshot_v1.sql");
    expect(sql).toContain(
      "revoke all on all tables in schema app_private from public, anon, authenticated, service_role",
    );
    expect(sql).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)\s+on\s+(?:table\s+)?app_private/iu,
    );
    expect(sql).not.toMatch(
      /grant\s+usage\s+on\s+schema\s+app_api\s+to\s+(?:anon|authenticated)/iu,
    );
    expect((sql.match(/grant execute on function app_api\./gu) ?? []).length).toBe(6);
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
  });

  it("uses a controlled PWA update and explicit no-cache matchers", () => {
    const worker = read("src/app/sw.ts");
    expect(worker).toContain("skipWaiting: false");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/s/")');
    expect(worker).toContain('url.pathname.startsWith("/search")');
    expect(worker).not.toContain("skipWaiting: true");
  });

  it("does not introduce unsafe HTML rendering or public privileged secrets", () => {
    const files = [
      "src/features/ticket/ticket-card.tsx",
      "src/features/plan/search-ledger.tsx",
      "src/features/import/import-screen.tsx",
      "src/features/share/supabase-repository.server.ts",
      ".env.example",
    ].map(read);
    expect(files.join("\n")).not.toContain("dangerouslySetInnerHTML");
    expect(read(".env.example")).not.toMatch(
      /NEXT_PUBLIC_(?:SUPABASE|SHARE|RATE|TURNSTILE_SECRET)/u,
    );
    expect(read("src/features/share/supabase-repository.server.ts")).toContain(
      'startsWith("sb_secret_")',
    );
  });

  it("opens the Turnstile CSP origin only on a full production ticket navigation", () => {
    const proxy = read("src/proxy.ts");
    const workspace = read("src/features/plan/plan-workspace.tsx");
    expect(proxy).toContain(
      'process.env.APP_PROFILE === "production" && request.nextUrl.pathname === "/ticket"',
    );
    expect(proxy).toContain("needsTurnstile ? turnstileOrigin : \"'none'\"");
    expect(proxy).not.toContain("SUPABASE_URL");
    expect(workspace).toContain('window.location.assign("/ticket")');
    expect(workspace).not.toContain('router.push("/ticket")');
    // Managed shares now live on the client-navigable /library route; the
    // Turnstile CSP boundary still only opens on the full /ticket navigation.
    expect(workspace).toContain('href="/library"');
    expect(read("src/features/ticket/ticket-screen.tsx")).not.toContain("<Link");
    expect(read("src/components/site-header.tsx")).not.toContain('from "next/link"');
  });

  it("fails production startup closed until historical slug key versions are available", () => {
    const instrumentation = read("src/instrumentation.ts");
    expect(instrumentation).toContain('process.env.NEXT_RUNTIME !== "nodejs"');
    expect(instrumentation).toContain('import("./instrumentation.node")');
    const nodeInstrumentation = read("src/instrumentation.node.ts");
    expect(nodeInstrumentation).toContain('process.env.APP_PROFILE === "fixture"');
    expect(nodeInstrumentation).toContain("assertRuntimeReleaseEnvironment()");
    expect(nodeInstrumentation).toContain("await assertRequiredShareKeyVersions()");
    const runtimeEnvironment = read("src/server/runtime-release-environment.ts");
    expect(runtimeEnvironment).toContain("RELEASE_REQUIRED_ENV");
    expect(runtimeEnvironment).toContain("assertConfiguredShareKeyVersions");
    expect(runtimeEnvironment).not.toContain('from "node:');
    const readiness = read("src/server/share-key-readiness.ts");
    expect(readiness).toContain("required_share_slug_key_versions_v1");
    expect(readiness).toContain("assertConfiguredShareKeyVersions");
  });
});
