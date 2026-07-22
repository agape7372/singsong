import { expect, test } from "@playwright/test";
import sharp from "sharp";

const desktopOnly = (projectName: string) =>
  test.skip(projectName !== "chromium-desktop", "covered once in the explicit desktop matrix");

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function addFixtureSong(page: import("@playwright/test").Page) {
  await page.goto("/search");
  await page.getByLabel("제목, 가수 또는 노래방 번호").fill("밤의 체크인");
  const result = page.getByRole("listitem").filter({ hasText: "밤의 체크인" }).first();
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: /밤의 체크인.*담기/u }).click();
  await expect(result.getByLabel(/밤의 체크인.*담김/u)).toHaveText("✓ 담김");
  const planRail = page.getByRole("complementary", { name: "현재 플랜 요약" });
  await expect(planRail).toContainText("1곡");
  await planRail.getByRole("link", { name: "플랜 보기" }).click();
  await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "오늘의 순서" })).toBeVisible();
}

test("IME pause, stale-response rejection, duplicate confirmation and both undo paths", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  const requestedQueries: string[] = [];
  await page.route("**/api/search", async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    requestedQueries.push(body.query);
    const stale = body.query === "밤의";
    await new Promise((resolve) => setTimeout(resolve, stale ? 650 : 20));
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: stale ? "stale-result" : "latest-result",
              title: stale ? "느린 과거 결과" : "최신 검색 결과",
              artist: "테스트 가수",
              karaokeCodes: { TJ: stale ? "100001" : "100002" },
              source: "fixture",
            },
          ],
          dataSource: "fixture",
          notice: "TEST DATA",
        }),
      })
      .catch(() => undefined);
  });

  await page.goto("/search");
  const search = page.getByLabel("제목, 가수 또는 노래방 번호");
  await search.dispatchEvent("compositionstart");
  await search.fill("밤의");
  await page.waitForTimeout(350);
  expect(requestedQueries).toEqual([]);

  await search.dispatchEvent("compositionend", { data: "의" });
  await expect.poll(() => requestedQueries.includes("밤의")).toBe(true);
  await search.fill("분홍");
  await expect(page.getByText("최신 검색 결과", { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByText("느린 과거 결과", { exact: true })).not.toBeVisible();

  const latestResult = page.getByRole("listitem").filter({ hasText: "최신 검색 결과" });
  await latestResult.getByRole("button", { name: /최신 검색 결과.*담기/u }).click();
  await expect(latestResult.getByLabel(/최신 검색 결과.*담김/u)).toHaveText("✓ 담김");
  await expect(latestResult.getByRole("button", { name: /담김/u })).not.toBeAttached();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(latestResult.getByRole("button", { name: /담기/u })).toBeEnabled();

  await page.getByRole("button", { name: "목록에 없나요? 직접 입력" }).click();
  await page.getByLabel("곡 제목").fill("같은 수동곡");
  await page.getByRole("textbox", { name: "가수", exact: true }).fill("같은 가수");
  await page.getByRole("button", { name: "세션에 담기" }).click();
  const planRail = page.getByRole("complementary", { name: "현재 플랜 요약" });
  await expect(planRail).toContainText("1곡");

  await page.getByRole("button", { name: "목록에 없나요? 직접 입력" }).click();
  await page.getByLabel("곡 제목").fill("같은 수동곡");
  await page.getByRole("textbox", { name: "가수", exact: true }).fill("같은 가수");
  await page.getByRole("button", { name: "세션에 담기" }).click();
  await expect(page.getByText(/같은 제목과 가수의 곡이 이미 있습니다/u)).toBeVisible();
  await expect(planRail).toContainText("1곡");
  await page.getByRole("button", { name: "세션에 담기" }).click();
  await expect(planRail).toContainText("2곡");

  await page.getByRole("link", { name: "플랜 보기" }).click();
  await expect(page.locator(".track-list li")).toHaveCount(2);

  await page.getByRole("button", { name: "같은 수동곡 삭제" }).first().click();
  await expect(page.locator(".track-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.locator(".track-list li")).toHaveCount(2);
});

test("exact responsive layouts, dark/forced colors, reduced motion and text reflow", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });

  for (const { width, height } of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "오늘의 순서" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await page.emulateMedia({ forcedColors: "none", colorScheme: "dark", reducedMotion: "reduce" });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await addFixtureSong(page);
  await page.getByRole("button", { name: "요금과 인원 입력하기" }).click();
  await page.getByLabel("나눌 인원").fill("2");
  await page.getByLabel("낱곡 가격 (원)").fill("1000");
  await page.getByRole("button", { name: "계산에 적용" }).click();
  for (const fontSize of ["200%", "400%"]) {
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = size;
    }, fontSize);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("button", { name: "1곡 티켓 만들기" })).toBeVisible();
  }
});

test("100 long tracks remain bounded and export a nonblank fixed-size ticket", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByText("00 / 100")).toBeVisible();

  await page.evaluate(async () => {
    const now = new Date().toISOString();
    const longArtist = "나".repeat(80);
    const plan = {
      id: "active-plan",
      revision: 100,
      createdAt: now,
      updatedAt: now,
      people: 4,
      pricing: { kind: "song", singlePriceWon: 1_000 },
      items: Array.from({ length: 100 }, (_, order) => {
        const prefix = `${order + 1}-`;
        return {
          id: `max-track-${order}`,
          source: "manual",
          catalogSongId: null,
          title: `${prefix}${"가".repeat(80 - prefix.length)}`,
          artist: longArtist,
          karaokeCodes: [],
          order,
        };
      }),
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("singsong-session-strip");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("plans", "readwrite");
        transaction.objectStore("plans").put(plan);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  await page.reload();
  await expect(page.getByText("100 / 100")).toBeVisible();
  await expect(page.locator(".track-list li")).toHaveCount(100);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "100곡 티켓 만들기" }).click();
  await expect(page.getByRole("heading", { name: "오늘의 세션 스트립" })).toBeVisible();
  await expect(page.getByText("나머지 96곡")).toBeVisible();
  await expect(page.locator(".ticket-track-list li")).toHaveCount(5);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장" }).click();
  const downloadPath = await (await downloadPromise).path();
  expect(downloadPath).not.toBeNull();
  const image = sharp(downloadPath!);
  await expect(image.metadata()).resolves.toMatchObject({
    format: "png",
    width: 1080,
    height: 1350,
  });
  const stats = await image.stats();
  expect(stats.channels.some((channel) => channel.stdev > 1)).toBe(true);
  expect(stats.dominant.r).toBeGreaterThan(230);
  expect(stats.dominant.g).toBeGreaterThan(230);
  expect(stats.dominant.b).toBeGreaterThan(230);
});

test("revocation removes HTML/API access while OG stays generic and import recovers", async ({
  page,
  request,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await addFixtureSong(page);
  await page.getByRole("button", { name: "요금과 인원 입력하기" }).click();
  await page.getByLabel("나눌 인원").fill("2");
  await page.getByLabel("낱곡 가격 (원)").fill("1000");
  await page.getByRole("button", { name: "계산에 적용" }).click();
  await page.getByRole("button", { name: "1곡 티켓 만들기" }).click();
  await page.getByRole("checkbox", { name: /위 공개 범위/u }).check();
  await page.getByRole("button", { name: "공유 링크 발급" }).click();
  const href = await page.getByRole("link", { name: "발급된 티켓 열기" }).getAttribute("href");
  expect(href).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/u);
  const slug = href!.split("/").at(-1)!;

  await page.getByRole("button", { name: "링크 폐기" }).first().click();
  await expect(page.getByText(/공유 링크를 폐기했습니다/u)).toBeVisible();

  expect((await request.get(href!)).status()).toBe(404);
  expect((await request.get(`/api/shares/${slug}`)).status()).toBe(404);
  const ogResponse = await request.get(`/api/og/${slug}`);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["cache-control"]).toContain("no-store");
  await expect(sharp(await ogResponse.body()).metadata()).resolves.toMatchObject({
    format: "png",
    width: 1200,
    height: 630,
  });

  await page.goto(`/import?slug=${slug}`);
  await expect(page.getByText(/찾을 수 없습니다/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "이 브라우저에 가져오기" })).not.toBeVisible();
});
