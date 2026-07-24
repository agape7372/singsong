import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("production PWA contract", () => {
  it("ships a self-contained Korean offline recovery document", () => {
    const fallback = read("public/offline.html");
    expect(fallback).toContain('<html lang="ko">');
    expect(fallback).toContain("연결은 없어도 세션은 남아 있어요.");
    expect(fallback).toContain('<a href="">다시 시도</a>');
    expect(fallback).toContain('href="/">세션으로 돌아가기</a>');
    expect(fallback).not.toMatch(/<script|https?:\/\//iu);
  });

  it("uses the hashed public fallback while keeping capability routes network-only", () => {
    const worker = read("src/app/sw.ts");
    expect(worker).toContain('url: "/offline.html"');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/s/")');
    expect(worker).toContain('url.pathname.startsWith("/search")');
    expect(worker).toContain('"/_next/static/chunks/app/api/"');
    expect(worker).toContain('"/_next/static/chunks/app/s/"');
    expect(worker).toContain('"/_next/static/chunks/app/search/"');
    expect(worker).toContain("!isNetworkOnlyChunk(url.pathname)");
    expect(worker.indexOf("new NetworkOnly()")).toBeLessThan(worker.indexOf("new CacheFirst"));
    expect(worker.indexOf("new NetworkOnly()")).toBeLessThan(worker.indexOf("new NetworkFirst"));
  });

  it("excludes API, share and search route chunks from generated precache", () => {
    const config = read("next.config.mjs");
    expect(config).toContain("/static\\/chunks\\/app\\/api\\//");
    expect(config).toContain("/static\\/chunks\\/app\\/s\\//");
    expect(config).toContain("/static\\/chunks\\/app\\/search\\//");
  });

  it("ships the cache-busting Folded Session S icon set", () => {
    const manifest = read("src/app/manifest.ts");
    const layout = read("src/app/layout.tsx");
    const worker = read("src/app/sw.ts");
    const icons = [
      "folded-session-s-180.png",
      "folded-session-s-192.png",
      "folded-session-s-512.png",
    ];

    for (const icon of icons) {
      expect(existsSync(path.join(process.cwd(), "public", "icons", icon))).toBe(true);
      expect(`${manifest}\n${layout}`).toContain(`/icons/${icon}`);
    }
    expect(worker).toContain('cacheName: "singsong-static-v2"');
  });
});
