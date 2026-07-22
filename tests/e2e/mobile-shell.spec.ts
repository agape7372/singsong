import { expect, test } from "@playwright/test";

const desktopOnly = (projectName: string) =>
  test.skip(projectName !== "chromium-desktop", "the exact viewport matrix runs once");

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const report = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
            element.className && typeof element.className === "string"
              ? `.${element.className.trim().replace(/\s+/gu, ".")}`
              : ""
          }`,
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
        };
      })
      .filter(({ left, right, width }) => width > 0 && (left < -1 || right > viewportWidth + 1))
      .slice(0, 12);
    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      offenders,
    };
  });
  expect(report.overflow, JSON.stringify(report.offenders, null, 2)).toBeLessThanOrEqual(1);
}

async function expectTwoItemPrimaryNav(
  page: import("@playwright/test").Page,
  current: "플랜" | "검색",
) {
  const nav = page.getByRole("navigation", { name: "주요 화면" });
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole("link")).toHaveCount(2);
  const planLink = nav.getByRole("link", { name: "플랜" });
  const searchLink = nav.getByRole("link", { name: "검색" });
  if (current === "플랜") {
    await expect(planLink).toHaveAttribute("aria-current", "page");
    await expect(searchLink).not.toHaveAttribute("aria-current");
  } else {
    await expect(searchLink).toHaveAttribute("aria-current", "page");
    await expect(planLink).not.toHaveAttribute("aria-current");
  }
  return nav;
}

test("one two-item nav changes from the mobile bottom to the wide header without duplication", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "오늘의 순서" })).toBeVisible();
    await expect(page.locator(".workspace-header")).toHaveCount(0);
    await expect(page.getByText("오늘 부를 곡을, 한 장의 흐름으로.")).not.toBeAttached();

    const nav = await expectTwoItemPrimaryNav(page, "플랜");
    const layout = await nav.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        bottom: bounds.bottom,
        viewportHeight: window.innerHeight,
        insideHeader: Boolean(element.closest(".site-header")),
      };
    });
    expect(layout.insideHeader).toBe(true);
    await expect(page.locator("[data-app-header-actions] details.workspace-overflow")).toHaveCount(
      1,
    );
    if (viewport.width < 900) {
      expect(layout.position).toBe("fixed");
      expect(Math.abs(layout.bottom - layout.viewportHeight)).toBeLessThanOrEqual(1);
    } else {
      expect(layout.position).toBe("static");
    }

    const empty = page.locator(".empty-strip");
    await expect(empty).toBeVisible();
    await expect(empty.locator("a, button")).toHaveCount(1);
    await expect(empty.getByRole("link", { name: "노래 찾으러 가기" })).toBeVisible();
    await expect(page.locator("[data-bottom-slot='true']")).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(".task-shell")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--bottom-slot-height"),
          ),
      )
      .toBe("0px");
    await expectNoHorizontalOverflow(page);
  }
});

test("search keeps a sticky input, continuous ledger and current-plan rail", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search");

  await expect(page.getByRole("heading", { name: "곡 찾기", exact: true })).toBeVisible();
  await expectTwoItemPrimaryNav(page, "검색");
  const stickyHead = page.locator(".search-ledger-head");
  await expect(stickyHead).toBeVisible();
  expect(await stickyHead.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");

  const planRail = page.getByRole("complementary", { name: "현재 플랜 요약" });
  await expect(planRail).toContainText("0곡");
  await expect(planRail.getByRole("link", { name: "플랜 보기" })).toHaveAttribute("href", "/");
  const bottomSlot = page.locator("[data-bottom-slot='true']");
  await expect(bottomSlot).toContainText("현재 플랜");

  const search = page.getByLabel("제목, 가수 또는 노래방 번호");
  await expect(search).toBeFocused();
  expect(await bottomSlot.evaluate((element) => getComputedStyle(element).position)).toBe("static");
  await search.fill("밤의 체크인");
  await expect(page.locator(".search-status-line")).toHaveText("검색 결과 1곡");

  const result = page.locator(".search-result-row").filter({ hasText: "밤의 체크인" });
  await expect(result).toHaveCount(1);
  await expect(result.locator(".search-result-index")).toHaveText("01");
  await result.getByRole("button", { name: /밤의 체크인.*담기/u }).click();
  await expect(result.getByLabel(/밤의 체크인.*담김/u)).toHaveText("✓ 담김");
  await expect(result.getByRole("button", { name: /담김/u })).not.toBeAttached();
  await expect(planRail).toContainText("1곡");
  await expect(planRail).toContainText(/약 \d+–\d+분/u);

  await search.evaluate((element) => (element as HTMLElement).blur());
  await expect
    .poll(() => bottomSlot.evaluate((element) => getComputedStyle(element).position))
    .toBe("fixed");
  await expectNoHorizontalOverflow(page);
});

test("home matches the station demo ledger, estimate and inline confirmation flow", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search");
  await page.getByLabel("제목, 가수 또는 노래방 번호").fill("밤의 체크인");
  const result = page.locator(".search-result-row").filter({ hasText: "밤의 체크인" });
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: /밤의 체크인.*담기/u }).click();
  await expect(result.getByLabel(/밤의 체크인.*담김/u)).toHaveText("✓ 담김");
  const planRail = page.getByRole("complementary", { name: "현재 플랜 요약" });
  await expect(planRail).toContainText("1곡");
  await planRail.getByRole("link", { name: "플랜 보기" }).click();

  await expect(page.getByRole("heading", { name: "오늘의 플랜" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "SINGSONG" })).toBeVisible();
  await expect(page.getByRole("list", { name: "참여자 1명" })).toBeVisible();
  await expect(page.getByText("함께하는 사람", { exact: true })).not.toBeAttached();
  const addParticipant = page.getByRole("button", { name: "참여자 한 명 추가" });
  const participantButtonShape = await addParticipant.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      borderRadius: style.borderRadius,
    };
  });
  expect(participantButtonShape.width).toBeGreaterThanOrEqual(44);
  expect(participantButtonShape.height).toBe(participantButtonShape.width);
  expect(participantButtonShape.borderRadius).toBe("50%");
  await addParticipant.click();
  await expect(page.getByRole("list", { name: "참여자 2명" })).toBeVisible();
  await expectTwoItemPrimaryNav(page, "플랜");
  await expect(page.locator(".working-session-strip")).toHaveCount(1);
  await expect(page.locator(".working-strip")).toHaveCount(1);
  await expect(page.locator(".calculation-strip")).toHaveCount(1);
  await expect(page.locator(".working-session-strip > .home-action-dock")).toHaveCount(1);
  await expect(page.locator("[data-bottom-slot='true']")).toHaveCount(0);
  await expect(page.getByText("QUEUE / 01")).not.toBeAttached();
  await expect(page.getByText("01 / 100")).not.toBeAttached();
  await expect(page.getByText("TJ 91001")).not.toBeAttached();
  await expect(page.getByText("빼기", { exact: true })).not.toBeAttached();
  await expect(page.getByRole("button", { name: "밤의 체크인 삭제" })).toBeVisible();

  const restingReorder = await page.locator(".station-reorder-controls").evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }));
  expect(restingReorder).toEqual({ opacity: "0", pointerEvents: "none" });

  const order = await page.evaluate(() => {
    const ledger = document.querySelector(".working-strip");
    const estimate = document.querySelector(".calculation-strip");
    const confirmation = document.querySelector(".home-action-dock");
    if (!ledger || !estimate || !confirmation) return null;
    return {
      ledgerBeforeEstimate: Boolean(
        ledger.compareDocumentPosition(estimate) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      estimateBeforeConfirmation: Boolean(
        estimate.compareDocumentPosition(confirmation) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    };
  });
  expect(order).toEqual({ ledgerBeforeEstimate: true, estimateBeforeConfirmation: true });

  const ledgerGeometry = await page.locator(".station-ledger").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: style.borderRadius,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
    };
  });
  expect(ledgerGeometry).toEqual({
    borderRadius: "0px",
    borderStyle: "solid",
    borderWidth: "1px",
  });

  const pricingDisclosure = page.locator("details.pricing-disclosure");
  const pricingSummary = pricingDisclosure.locator("summary.estimate-strip");
  await expect(pricingSummary.locator(".estimate-cell")).toHaveCount(2);
  await expect(pricingSummary).toContainText("시간");
  await expect(pricingSummary).toContainText("예상 비용");
  await expect(pricingSummary).toContainText("요금 입력 필요");
  const estimateGeometry = await pricingSummary.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: style.borderRadius,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
    };
  });
  expect(estimateGeometry).toEqual({
    borderRadius: "0px",
    borderStyle: "solid",
    borderWidth: "1px",
  });

  const confirmation = page.locator(".home-action-dock");
  await expect(confirmation).toContainText("완료");
  await expect(confirmation).not.toContainText("확정하는 순간");
  expect(await confirmation.evaluate((element) => getComputedStyle(element).position)).toBe(
    "static",
  );

  await page.locator(".home-confirm-action").click();
  await expect(pricingDisclosure).toHaveAttribute("open", "");
  await expect(page.getByLabel("나눌 인원")).toBeFocused();
  await page.getByLabel("나눌 인원").fill("2");
  await page.getByLabel("낱곡 가격 (원)").fill("1000");
  await page.getByRole("button", { name: "계산에 적용" }).click();

  await expect(pricingDisclosure).not.toHaveAttribute("open", "");
  await expect(pricingSummary).toBeFocused();
  await expect(page.locator(".calculation-summary")).toContainText("계산 결과");
  await expect(page.locator(".calculation-summary")).toContainText("1곡");
  await expect(page.locator(".calculation-summary")).toContainText("₩1,000");
  await expect(pricingSummary).toContainText("₩1,000");
  await expect(page.locator(".home-confirm-action")).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.locator("[data-bottom-slot='true']")).toHaveCount(0);
  await expect(page.locator(".home-confirm-action")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
