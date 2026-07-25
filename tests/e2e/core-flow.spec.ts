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
  await expect(page.getByRole("button", { name: "노래 찾으러 가기" })).toBeVisible();
  await expect(page.getByText("오늘 부를 곡을, 한 장의 흐름으로.")).not.toBeAttached();
  await expectNoCriticalA11y(page);

  // 곡 담기는 별도 라우트가 아니라 bottom sheet다(4탭 IA 재설계 이후).
  await page.getByRole("button", { name: "노래 찾으러 가기" }).click();
  await expect(page.getByRole("dialog", { name: "곡 담기" })).toBeVisible();
  await expect(page.getByText("TEST DATA", { exact: true })).toBeVisible();
  await expectNoCriticalA11y(page);

  await addFixtureSong(page, "밤의 체크인", "밤의 체크인");
  await addFixtureSong(page, "분홍 영수증", "분홍 영수증");
  await addFixtureSong(page, "마지막 환승", "마지막 환승");
  await expect(page.getByText("3곡 담김")).toBeVisible();
  await page.getByRole("button", { name: "검색 닫기" }).click();
  await expect(page.getByRole("dialog", { name: "곡 담기" })).toBeHidden();
  await expect(page.locator(".station-ledger-count")).toHaveText("3");

  const secondTrack = page.locator(".station-track-row").filter({ hasText: "분홍 영수증" });
  await secondTrack.press("Alt+ArrowUp");
  await expect(page.locator(".track-list li").nth(0)).toContainText("분홍 영수증");

  await page.locator(".home-confirm-action").click();
  await expect(page.locator("details.pricing-disclosure")).toHaveAttribute("open", "");
  await expect(page.getByLabel("나눌 인원")).toBeFocused();
  await page.getByLabel("나눌 인원").fill("3");
  await page.getByLabel("낱곡 가격 (원)").fill("1000");
  await page.getByLabel("묶음 곡 수 (선택)").fill("3");
  await page.getByLabel("묶음 가격 (원)").fill("2500");
  await page.getByRole("button", { name: "계산에 적용" }).click();
  await expect(page.getByText("₩2,500").first()).toBeVisible();
  const issueButton = page.locator(".home-confirm-action");
  await expect(issueButton).toBeEnabled();

  await page.evaluate(() => {
    Object.defineProperty(globalThis, "__singsongDocumentMarker", { value: true });
  });
  await issueButton.click();
  await expect(page).toHaveURL(/\/ticket$/u);
  expect(await page.evaluate(() => "__singsongDocumentMarker" in globalThis)).toBe(false);
  await expect(page.getByRole("heading", { name: "오늘의 세션 스트립" })).toBeVisible();
  // 플립 티켓은 앞/뒷면 두 장이 .ticket-card다. 앞면만 본다.
  const ticketPunchBorders = await page
    .locator(".ticket-card")
    .first()
    .evaluate((element) => ({
      before: getComputedStyle(element, "::before").borderWidth,
      after: getComputedStyle(element, "::after").borderWidth,
    }));
  expect(ticketPunchBorders).toEqual({ before: "0px", after: "0px" });
  await expectNoCriticalA11y(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^singsong-ticket-[a-f0-9]{8}\.png$/u);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const image = await sharp(downloadPath!).metadata();
  expect(image).toMatchObject({ format: "png", width: 1080, height: 1350 });

  // 색과 배치를 실제 픽셀로 확인한다. 예전 내보내기는 장미색이 전부 검정으로 떨어지고
  // 티켓이 캔버스 좌측 55%에만 그려졌는데, 크기 단언만으로는 둘 다 통과했다.
  const { data, info } = await sharp(downloadPath!).raw().toBuffer({ resolveWithObject: true });
  let rosePixels = 0;
  let roseTop = Number.POSITIVE_INFINITY;
  let roseBottom = -1;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset]!;
    const green = data[offset + 1]!;
    const blue = data[offset + 2]!;
    if (red > 200 && green < 120 && blue > 60 && blue < 190) {
      rosePixels += 1;
      const row = Math.floor(offset / info.channels / info.width);
      if (row < roseTop) roseTop = row;
      if (row > roseBottom) roseBottom = row;
    }
  }
  expect(rosePixels).toBeGreaterThan(20_000);
  // 헤더·컴포지션·스텁 높이 합이 675px를 넘으면 컴포지션만 눌려 도형 아래가 잘린다.
  // 컴포지션은 스텁 점선(≈y1060) 바로 위까지 내려와야 한다. 눌리면 여기서 멈춘다.
  expect(roseTop).toBeLessThan(300);
  expect(roseBottom).toBeGreaterThan(1_000);
  const rightBand = await sharp(downloadPath!)
    .extract({ left: 864, top: 700, width: 216, height: 400 })
    .stats();
  expect(rightBand.channels.some((channel) => channel.stdev > 5)).toBe(true);

  // 라운드 모서리 증거 — 좌상단 4px는 티켓 종이(#f6efdc)가 아니라 캔버스(#faf7f0)여야 한다.
  const corner = await sharp(downloadPath!)
    .extract({ left: 0, top: 0, width: 4, height: 4 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(corner.data[0]).toBeGreaterThan(0xf5);
  expect(corner.data[2]).toBeGreaterThan(0xe8);

  await page.getByRole("checkbox", { name: /공개 범위와 30일 만료/u }).check();
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
  await expect(page.locator(".station-ledger-count")).toHaveText("3");

  await page.locator("details.workspace-overflow > summary").click();
  await page.getByRole("button", { name: "새 플랜 시작" }).click();
  await expect(page.locator("details.workspace-overflow")).not.toHaveAttribute("open", "");
  const newPlanDialog = page.getByRole("alertdialog");
  await expect(newPlanDialog).toContainText("현재 3곡과 계산 설정이 새 플랜으로 교체됩니다.");
  await newPlanDialog.getByRole("button", { name: "취소" }).click();
  await expect(page.locator(".station-ledger-count")).toHaveText("3");

  await page.locator("details.workspace-overflow > summary").click();
  await page.getByRole("button", { name: "새 플랜 시작" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "새 플랜 시작" }).click();
  await expect(page.getByText("0곡", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이전 플랜 되돌리기" }).click();
  await expect(page.locator(".station-ledger-count")).toHaveText("3");
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
  expect(focusPresentation.outlineOffset).toBe(3);
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
