import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const shareCapability = "AAAAAAAAAAAAAAAAAAAAAA";

test("production HTTP serves a private generic OG image with security headers", async ({
  request,
}) => {
  const response = await request.get(`/api/og/${shareCapability}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  const image = await sharp(await response.body()).metadata();
  expect(image).toMatchObject({ format: "png", width: 1200, height: 630 });
});

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
      } catch {
        // PwaRegister intentionally reloads once on controllerchange. Retry in
        // the replacement document instead of treating that navigation as a
        // registration failure.
        return null;
      }
    })
    .toContain("/sw.js");
  await page.waitForLoadState("domcontentloaded");
}

async function cachedUrls(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
}

test("production service worker keeps only the local shell and fails closed for capabilities", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "오늘의 순서" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "주요 화면" })).toHaveCount(1);
  await waitForServiceWorker(page);

  // Warm only the explicit local shell routes after the first controller is active.
  await page.goto("/ticket");
  await page.goto("/import");
  await page.goto("/offline");
  await page.goto("/");

  // Exercise the excluded routes while online; none may enter Cache Storage.
  await page.goto("/search");
  await page.goto(`/s/${shareCapability}`);
  await page.goto("/");
  const onlineSearch = await page.evaluate(async () => {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "밤의" }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(onlineSearch.status).toBe(200);
  expect(onlineSearch.body).toMatchObject({
    dataSource: process.env.APP_PROFILE === "production" ? "licensed" : "fixture",
  });

  const urls = (await cachedUrls(page)).map((value) => new URL(value).pathname);
  const forbidden = urls.filter(
    (pathname) =>
      pathname.startsWith("/api/") ||
      pathname.startsWith("/s/") ||
      pathname === "/search" ||
      /\/_next\/static\/chunks\/app\/(?:api|s|search)\//u.test(pathname),
  );
  expect(forbidden).toEqual([]);
  expect(urls).toContain("/offline.html");

  await context.setOffline(true);
  try {
    await page.goto("/ticket");
    await expect(
      page.getByRole("heading", { name: "현재 순서의 티켓이 아직 없어요." }),
    ).toBeVisible();

    await page.goto("/search");
    await expect(
      page.getByRole("heading", { name: "연결은 없어도 세션은 남아 있어요." }),
    ).toBeVisible();

    await page.goto(`/s/${shareCapability}`);
    await expect(
      page.getByRole("heading", { name: "연결은 없어도 세션은 남아 있어요." }),
    ).toBeVisible();

    const apiResult = await page.evaluate(async () => {
      try {
        await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "밤의" }),
        });
        return "unexpected-response";
      } catch {
        return "network-error";
      }
    });
    expect(apiResult).toBe("network-error");
  } finally {
    await context.setOffline(false);
  }
});

test("a real waiting worker activates only after explicit update consent", async ({ page }) => {
  test.skip(
    process.env.APP_PROFILE === "production",
    "the controlled byte-for-byte worker replacement runs against the local production artifact",
  );
  const workerPath = path.join(process.cwd(), "public", "sw.js");
  const originalWorker = await readFile(workerPath, "utf8");

  await page.goto("/");
  await waitForServiceWorker(page);
  await page.reload();
  await waitForServiceWorker(page);

  try {
    await writeFile(workerPath, `${originalWorker}\n// controlled-update-browser-test\n`, "utf8");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

    await expect(page.getByRole("button", { name: "나중에" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "나중에" }).click();
    await expect(page.getByText(/새 버전이 준비됐습니다/)).not.toBeVisible();
    await expect
      .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)))
      .toBe(true);

    await page.reload();
    await expect(page.getByRole("button", { name: "업데이트" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "업데이트" }).click();

    await expect
      .poll(async () => {
        try {
          return await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return (
              !registration.waiting && navigator.serviceWorker.controller?.state === "activated"
            );
          });
        } catch {
          return false;
        }
      })
      .toBe(true);
  } finally {
    await writeFile(workerPath, originalWorker, "utf8");
  }
});
