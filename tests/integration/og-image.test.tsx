import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { calculatePlan } from "@/domain/calculation";
import { buildSharedSnapshot } from "@/domain/canonical";
import type { Plan } from "@/domain/models";
import { LocalShareRepository } from "@/features/share/local-repository.server";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: {
      article: React.forwardRef<HTMLElement, Record<string, unknown>>(function StaticArticle(
        { initial, animate, transition, children, ...props },
        ref,
      ) {
        void initial;
        void animate;
        void transition;
        return React.createElement("article", { ...props, ref }, children as React.ReactNode);
      }),
    },
    useReducedMotion: () => false,
  };
});

beforeAll(() => {
  process.env.APP_PROFILE = "fixture";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
});

const plan: Plan = {
  id: "og-test-plan",
  revision: 1,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  people: 3,
  pricing: { kind: "song", singlePriceWon: 1_000 },
  items: [
    {
      id: "local-only",
      source: "manual",
      catalogSongId: null,
      title: "사용자 입력 제목은 OG에 노출하지 않음",
      artist: "사용자 입력 가수",
      karaokeCodes: [],
      order: 0,
    },
  ],
};

async function issueShare() {
  const calculation = calculatePlan(1, plan.pricing!, plan.people!);
  const payload = buildSharedSnapshot(plan, calculation, "GGGGGGGGGGGGGGGGGGGGGA");
  return new LocalShareRepository().create({
    idempotencyKey: "HHHHHHHHHHHHHHHHHHHHHA",
    revokeToken: "IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
    payload,
    canonicalPayload: JSON.stringify(payload),
    fingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });
}

describe("share Open Graph image", () => {
  it("ships the real Korean TTF subset and its license", async () => {
    const font = await readFile(
      path.join(process.cwd(), "src", "assets", "fonts", "NotoSansKR-700.subset.ttf"),
    );
    const license = await readFile(
      path.join(process.cwd(), "src", "assets", "fonts", "OFL.txt"),
      "utf8",
    );
    expect([...font.subarray(0, 4)]).toEqual([0, 1, 0, 0]);
    expect(font.byteLength).toBeGreaterThan(1_000);
    expect(license).toContain("SIL OPEN FONT LICENSE");
  });

  it("renders a private 1200x630 PNG without exposing track strings", async () => {
    const share = await issueShare();
    const { GET } = await import("@/app/api/og/[slug]/route");
    const response = await GET(new Request(`http://localhost:3000/api/og/${share.slug}`), {
      params: Promise.resolve({ slug: share.slug }),
    });
    const body = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(body).metadata();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(metadata).toMatchObject({ format: "png", width: 1_200, height: 630 });

    const routeSource = await readFile(
      path.join(process.cwd(), "src", "app", "api", "og", "[slug]", "route.tsx"),
      "utf8",
    );
    expect(routeSource).not.toContain(plan.items[0]!.title);
    expect(routeSource).not.toContain(plan.items[0]!.artist);
    expect(routeSource).not.toMatch(/payload\.items|item\.(?:title|artist)/u);
  });

  it("returns the same generic no-store image contract for an invalid capability", async () => {
    const { GET } = await import("@/app/api/og/[slug]/route");
    const response = await GET(new Request("http://localhost:3000/api/og/not-a-capability"), {
      params: Promise.resolve({ slug: "not-a-capability" }),
    });
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(metadata).toMatchObject({ format: "png", width: 1_200, height: 630 });
  });

  it("wires dynamic noindex metadata to the dedicated image route", async () => {
    const share = await issueShare();
    const { generateMetadata } = await import("@/app/s/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: share.slug }) });
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toBe("1곡 세션 티켓");
    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(serialized).toContain(`/api/og/${share.slug}`);
    expect(serialized).toContain("summary_large_image");
    expect(serialized).toContain("싱송 공유 세션 티켓 요약");
  }, 15_000);

  it("renders the received snapshot under one Korean heading hierarchy with a public-range notice", async () => {
    const share = await issueShare();
    const { default: SharedTicketPage } = await import("@/app/s/[slug]/page");
    const page = await SharedTicketPage({ params: Promise.resolve({ slug: share.slug }) });
    const html = renderToStaticMarkup(page);
    const articleHeading = /<article\b[^>]*\baria-labelledby="([^"]+)"/u.exec(html)?.[1];

    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('<h1 id="shared-ticket-heading">함께 부를 세션이 도착했어요.</h1>');
    expect(articleHeading).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<h2 id="${articleHeading}"[^>]*>오늘의 세션 스트립</h2>`, "u"),
    );
    expect(html).toContain('<h3 id="shared-ledger-heading">전체 곡 순서</h3>');
    expect(html).toContain('<h3 id="handoff-heading">내 순서로 이어서 편집할까요?</h3>');
    expect(html).toContain(
      "이 주소는 검색 목록에 공개되지 않지만, 주소를 아는 사람은 만료 전까지 볼 수 있습니다.",
    );
  });
});
