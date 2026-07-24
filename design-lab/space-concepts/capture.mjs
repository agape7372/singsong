import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputRoot = "C:/tmp/singsong-space-concepts";
const pageUrl = pathToFileURL(path.resolve("design-lab/space-concepts/index.html")).href;
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "load" });
  await page.locator("#concept-10").waitFor();

  const conceptCount = await page.locator(".concept-card").count();
  if (conceptCount !== 10) throw new Error(`Expected 10 concepts, found ${conceptCount}`);
  if (await page.locator(".app-demo .ticket-perforation").count()) {
    throw new Error("Ticket visual leaked into the planning space.");
  }
  if (await page.locator("#ticket-dialog").evaluate((dialog) => dialog.open)) {
    throw new Error("Ticket dialog must be closed before confirmation.");
  }

  await page.screenshot({ path: `${outputRoot}/gallery-wide.png`, fullPage: true });
  await page.locator(".filter-bar").evaluate((element) => {
    element.style.display = "none";
  });

  for (let index = 1; index <= 10; index += 1) {
    const number = String(index).padStart(2, "0");
    await page.locator(`#concept-${number} .app-demo`).screenshot({
      path: `${outputRoot}/concept-${number}.png`,
      animations: "disabled",
    });
  }

  const axeResult = await new AxeBuilder({ page }).include("#concept-grid").analyze();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "load" });
  await page.locator(".filter-bar").evaluate((element) => {
    element.style.display = "none";
  });
  const station = page.locator("#concept-10");
  await station.scrollIntoViewIfNeeded();

  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  const undersizedControls = await page.evaluate(() =>
    [...document.querySelectorAll(".concept-card button")]
      .filter((element) => !element.closest("[hidden]"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          width: Math.round(bounds.width * 10) / 10,
          height: Math.round(bounds.height * 10) / 10,
        };
      })
      .filter(({ width, height }) => width < 44 || height < 44),
  );

  await page.keyboard.press("Tab");
  const focusIndicator = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const style = getComputedStyle(active);
    return {
      element: active.className || active.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });

  await station.locator(".people-plus").click();
  await station.locator(".add-song").click();
  const people = await station.locator(".people-count").textContent();
  const songs = await station.locator(".song-count").textContent();
  if (people !== "5명" || songs !== "4곡") {
    throw new Error(`Interaction mismatch: people=${people}, songs=${songs}`);
  }

  await station.locator(".app-demo").screenshot({
    path: `${outputRoot}/concept-10-mobile-interacted.png`,
    animations: "disabled",
  });
  await station.locator(".confirm-plan").click();
  await page.locator("#ticket-dialog[open]").waitFor();
  await page.locator(".ticket-dialog-shell").screenshot({
    path: `${outputRoot}/ticket-reveal-mobile.png`,
    animations: "disabled",
  });

  const ticketFacts = {
    people: await page.locator("#ticket-people").textContent(),
    songs: await page.locator("#ticket-songs").textContent(),
    time: await page.locator("#ticket-time").textContent(),
    cost: await page.locator("#ticket-cost").textContent(),
  };

  await writeFile(
    `${outputRoot}/validation.json`,
    JSON.stringify(
      {
        conceptCount,
        overflow,
        undersizedControls,
        focusIndicator,
        axeViolations: axeResult.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        })),
        ticketFacts,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
