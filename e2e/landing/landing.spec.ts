import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

const origin = "http://127.0.0.1:4317";

type CreatedShare = {
  slug: string;
  revokeToken: string;
  expiresAt: string;
  fingerprint: string;
};

function capability() {
  return randomBytes(16).toString("base64url");
}

function sharedSnapshot(title: string) {
  return {
    schemaVersion: 1,
    artworkSeed: capability(),
    items: [
      {
        source: "manual",
        title,
        artist: "테스트 가수",
        karaokeCodes: [{ vendor: "TJ", code: "91001" }],
        order: 0,
      },
    ],
    calculation: {
      modelVersion: "fallback-v1",
      songCount: 1,
      duration: {
        lowSec: 165,
        midpointSec: 210,
        highSec: 255,
        coverageBps: 0,
      },
      pricing: { kind: "song", singlePriceWon: 1_000 },
      people: 2,
      derived: {
        totalLowWon: 1_000,
        totalHighWon: 1_000,
        perPersonLowWon: 500,
        perPersonHighWon: 500,
      },
    },
  };
}

async function createShare(request: APIRequestContext, title: string) {
  const response = await request.post("/api/shares", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-SingSong-Client": "fixture/0.1.0",
    },
    data: {
      idempotencyKey: capability(),
      revokeToken: randomBytes(32).toString("base64url"),
      payload: sharedSnapshot(title),
    },
  });

  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as CreatedShare;
}

async function metadata(page: Page, selector: string) {
  const value = await page.locator(selector).getAttribute("content");
  expect(value).toBeTruthy();
  return value as string;
}

test("renders an absolute, script-free share contract with a usable app handoff", async ({
  page,
  request,
}) => {
  const share = await createShare(request, "밤의 체크인");
  const shareUrl = `${origin}/s/${share.slug}`;
  const response = await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  await expect(page.getByText("밤의 체크인")).toBeVisible();
  await expect(page.getByText("테스트 가수")).toBeVisible();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", shareUrl);
  const ogTitle = await metadata(page, 'meta[property="og:title"]');
  const ogDescription = await metadata(page, 'meta[property="og:description"]');
  const ogUrl = await metadata(page, 'meta[property="og:url"]');
  const ogImage = await metadata(page, 'meta[property="og:image"]');

  expect(await page.title()).toContain(ogTitle);
  expect(await metadata(page, 'meta[name="description"]')).toBe(ogDescription);
  expect(ogUrl).toBe(shareUrl);
  expect(new URL(ogUrl).origin).toBe(origin);
  expect(new URL(ogImage).origin).toBe(origin);
  expect(new URL(ogImage).pathname).toBe("/og/ticket-1200x630.png");

  const imageResponse = await request.get(ogImage);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");

  await expect(page.locator("article.ticket > svg")).toHaveCount(1);
  await expect(page.locator("article.ticket > svg title")).toHaveCount(1);
  await expect(page.locator("script")).toHaveCount(0);

  const deepLink = page.locator(`a[href="singsong://s/${share.slug}"]`);
  await expect(deepLink).toBeVisible();
  expect((await deepLink.textContent())?.trim()).not.toBe("");
  const touchTarget = await deepLink.boundingBox();
  expect(touchTarget?.height).toBeGreaterThanOrEqual(48);
});

test("has no automated axe violations on the live landing", async ({ page, request }) => {
  const share = await createShare(request, "접근성 점검 노래");
  const response = await page.goto(`/s/${share.slug}`, { waitUntil: "networkidle" });

  expect(response?.status()).toBe(200);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(
    scan.violations,
    scan.violations
      .map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(", ")}`,
      )
      .join("\n"),
  ).toEqual([]);
});

test("returns clean 404 landings for revoked and unknown shares", async ({ page, request }) => {
  const share = await createShare(request, "폐기할 공유");
  const revoked = await request.delete(`/api/shares/${share.slug}`, {
    headers: {
      Authorization: `Bearer ${share.revokeToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-SingSong-Client": "fixture/0.1.0",
    },
    data: {},
  });

  expect(revoked.status()).toBe(204);

  const revokedPage = await page.goto(`/s/${share.slug}`, { waitUntil: "domcontentloaded" });
  expect(revokedPage?.status()).toBe(404);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  const unknownSlug = `${"Z".repeat(21)}A`;
  const unknownPage = await page.goto(`/s/${unknownSlug}`, { waitUntil: "domcontentloaded" });
  expect(unknownPage?.status()).toBe(404);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});
