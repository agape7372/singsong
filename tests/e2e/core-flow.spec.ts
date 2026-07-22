import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

async function expectNoCriticalA11y(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
}

async function addFixtureSong(page: import("@playwright/test").Page, query: string, title: string) {
  const search = page.getByLabel("제목, 가수 또는 노래방 번호");
  await search.fill(query);
  const result = page.getByRole("listitem").filter({ hasText: title }).first();
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: new RegExp(`${title}.*담기`, "u") }).click();
  await expect(result.getByLabel(new RegExp(`${title}.*담김`, "u"))).toHaveText("✓ 담김");
}

test("organizer issues, shares, receives and explicitly imports one session strip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "오늘의 순서" })).toBeVisible();
  await expect(page.getByRole("link", { name: "노래 찾으러 가기" })).toBeVisible();
  await expect(page.getByText("오늘 부를 곡을, 한 장의 흐름으로.")).not.toBeAttached();
  await expectNoCriticalA11y(page);

  await page.getByRole("link", { name: "노래 찾으러 가기" }).click();
  await expect(page).toHaveURL(/\/search$/u);
  await expect(page.getByRole("heading", { name: "곡 찾기", exact: true })).toBeVisible();
  await expect(page.getByText("TEST DATA", { exact: true })).toBeVisible();
  await expectNoCriticalA11y(page);

  await addFixtureSong(page, "밤의 체크인", "밤의 체크인");
  await addFixtureSong(page, "분홍 영수증", "분홍 영수증");
  await addFixtureSong(page, "마지막 환승", "마지막 환승");
  await expect(page.getByRole("complementary", { name: "현재 플랜 요약" })).toContainText("3곡");
  await page.getByRole("link", { name: "플랜 보기" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByText("03 / 100")).toBeVisible();

  const secondTrack = page.getByRole("listitem").filter({ hasText: "분홍 영수증" });
  await secondTrack.getByRole("button", { name: "분홍 영수증 한 칸 위로" }).click();
  await expect(page.locator(".track-list li").nth(0)).toContainText("분홍 영수증");

  await page.getByRole("button", { name: "요금과 인원 입력하기" }).click();
  await expect(page.locator("details.pricing-disclosure")).toHaveAttribute("open", "");
  await expect(page.getByLabel("나눌 인원")).toBeFocused();
  await page.getByLabel("나눌 인원").fill("3");
  await page.getByLabel("낱곡 가격 (원)").fill("1000");
  await page.getByLabel("묶음 곡 수 (선택)").fill("3");
  await page.getByLabel("묶음 가격 (원)").fill("2500");
  await page.getByRole("button", { name: "계산에 적용" }).click();
  await expect(page.getByText("₩2,500").first()).toBeVisible();
  const issueButton = page.getByRole("button", { name: "3곡 티켓 만들기" });
  await expect(issueButton).toBeEnabled();

  await page.evaluate(() => {
    Object.defineProperty(globalThis, "__singsongDocumentMarker", { value: true });
  });
  await issueButton.click();
  await expect(page).toHaveURL(/\/ticket$/u);
  expect(await page.evaluate(() => "__singsongDocumentMarker" in globalThis)).toBe(false);
  await expect(page.getByRole("heading", { name: "오늘의 세션 스트립" })).toBeVisible();
  await expectNoCriticalA11y(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^singsong-ticket-[a-f0-9]{8}\.png$/u);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const image = await sharp(downloadPath!).metadata();
  expect(image).toMatchObject({ format: "png", width: 1080, height: 1350 });

  await page.getByRole("checkbox", { name: /위 공개 범위/u }).check();
  await page.getByRole("button", { name: "공유 링크 발급" }).click();
  const issuedLink = page.getByRole("link", { name: "발급된 티켓 열기" });
  await expect(issuedLink).toBeVisible();
  const href = await issuedLink.getAttribute("href");
  expect(href).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/u);

  await page.goto(href!);
  await expect(page.getByRole("heading", { name: "함께 부를 세션이 도착했어요." })).toBeVisible();
  await expect(page.getByText("READ ONLY")).toBeVisible();
  await expectNoCriticalA11y(page);

  await page.getByRole("link", { name: "이 브라우저로 가져오기" }).click();
  await expect(page).toHaveURL(/\/import\?slug=/u);
  await expect(page.getByText("티켓 무결성을 확인했습니다.")).toBeVisible();
  await page.getByRole("button", { name: "이 브라우저에 가져오기" }).click();
  await expect(page.getByRole("heading", { name: "현재 플랜을 바꿀까요?" })).toBeVisible();
  await page.getByRole("button", { name: "현재 플랜 바꾸기" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByText("03 / 100")).toBeVisible();

  await page.locator("details.workspace-overflow > summary").click();
  await page.getByRole("button", { name: "새 플랜 시작" }).click();
  await expect(page.locator("details.workspace-overflow")).not.toHaveAttribute("open", "");
  const newPlanDialog = page.getByRole("alertdialog");
  await expect(newPlanDialog).toContainText("현재 3곡과 계산 설정이 새 플랜으로 교체됩니다.");
  await newPlanDialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByText("03 / 100")).toBeVisible();

  await page.locator("details.workspace-overflow > summary").click();
  await page.getByRole("button", { name: "새 플랜 시작" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "새 플랜 시작" }).click();
  await expect(page.getByText("00 / 100")).toBeVisible();
  await page.getByRole("button", { name: "이전 플랜 되돌리기" }).click();
  await expect(page.getByText("03 / 100")).toBeVisible();
});

test("empty, invalid and compact states provide recovery without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/ticket");
  await expect(
    page.getByRole("heading", { name: "현재 순서의 티켓이 아직 없어요." }),
  ).toBeVisible();
  await expectNoCriticalA11y(page);

  await page.evaluate(() => {
    Object.defineProperty(globalThis, "__singsongTicketDocumentMarker", { value: true });
  });
  await page.getByRole("link", { name: "세션으로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/$/u);
  expect(await page.evaluate(() => "__singsongTicketDocumentMarker" in globalThis)).toBe(false);

  await page.goto("/import");
  await page
    .getByLabel("티켓 주소 또는 22자 코드")
    .fill("https://evil.example/s/AAAAAAAAAAAAAAAAAAAAAA");
  await page.getByRole("button", { name: "티켓 확인" }).click();
  await expect(
    page.getByText("이 사이트의 정확한 티켓 주소 또는 22자 코드를 입력해 주세요."),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expectNoCriticalA11y(page);
});

test("keyboard skip navigation exposes focus and enters the planner without a trap", async ({
  page,
}) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "본문으로 건너뛰기" });

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  const focusPresentation = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineOffset: Number.parseFloat(style.outlineOffset),
      outlineColor: style.outlineColor,
      inkColor: getComputedStyle(document.body).color,
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
  expect(focusPresentation.outlineWidth).toBe(2);
  expect(focusPresentation.outlineOffset).toBe(2);
  expect(focusPresentation.outlineColor).toBe(focusPresentation.inkColor);
  expect(focusPresentation.top).toBeGreaterThanOrEqual(0);
  expect(focusPresentation.bottom).toBeGreaterThan(focusPresentation.top);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/u);
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector("main")?.contains(document.activeElement)),
    )
    .toBe(true);
  await expect(page.locator(":focus")).toBeVisible();
});
