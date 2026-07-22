import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "@playwright/test";

const port = Number(process.env.PERF_PORT ?? "3400");
const origin = `http://127.0.0.1:${port}`;
const repetitions = 5;

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_PROFILE: "fixture",
      NEXT_PUBLIC_APP_PROFILE: "fixture",
      NEXT_PUBLIC_SITE_URL: origin,
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

let serverOutput = "";
const remember = (chunk) => {
  serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-20_000);
};
child.stdout.on("data", remember);
child.stderr.on("data", remember);

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early\n${serverOutput}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`next start did not become ready\n${serverOutput}`);
}

const observerBootstrap = () => {
  globalThis.__singsongPerf = { lcpMs: 0, cls: 0, longTasks: [] };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries.at(-1);
      if (latest) globalThis.__singsongPerf.lcpMs = latest.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) globalThis.__singsongPerf.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      globalThis.__singsongPerf.longTasks.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // Missing APIs are reported as zero and rejected below.
  }
};

async function configurePage(context, page) {
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: (10 * 1024 * 1024) / 8,
    uploadThroughput: (5 * 1024 * 1024) / 8,
    connectionType: "wifi",
  });
}

async function readPageMetrics(page) {
  await page.waitForTimeout(750);
  return page.evaluate(() => {
    const values = globalThis.__singsongPerf;
    const tbtMs = values.longTasks.reduce(
      (total, duration) => total + Math.max(0, duration - 50),
      0,
    );
    return {
      lcpMs: Math.round(values.lcpMs * 10) / 10,
      tbtMs: Math.round(tbtMs * 10) / 10,
      cls: Math.round(values.cls * 10_000) / 10_000,
      longTasksOver50Ms: values.longTasks.filter((duration) => duration > 50).length,
    };
  });
}

async function measureNavigation(browser, cold) {
  if (cold) {
    const samples = [];
    for (let index = 0; index < repetitions; index += 1) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.addInitScript(observerBootstrap);
      const page = await context.newPage();
      await configurePage(context, page);
      await page.goto(origin, { waitUntil: "networkidle" });
      samples.push(await readPageMetrics(page));
      await context.close();
    }
    return samples;
  }

  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(observerBootstrap);
  const page = await context.newPage();
  await configurePage(context, page);
  await page.goto(origin, { waitUntil: "networkidle" });
  const samples = [];
  for (let index = 0; index < repetitions; index += 1) {
    await page.reload({ waitUntil: "networkidle" });
    samples.push(await readPageMetrics(page));
  }
  await context.close();
  return samples;
}

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    worst: sorted.at(-1),
  };
}

function summarizeNavigation(samples) {
  return {
    lcpMs: distribution(samples.map((sample) => sample.lcpMs)),
    tbtMs: distribution(samples.map((sample) => sample.tbtMs)),
    cls: distribution(samples.map((sample) => sample.cls)),
    longTasksOver50Ms: distribution(samples.map((sample) => sample.longTasksOver50Ms)),
  };
}

function latencySummary(durations) {
  const sorted = [...durations].sort((left, right) => left - right);
  return {
    samples: sorted.length,
    p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 10) / 10,
    worstMs: Math.round(sorted.at(-1) * 10) / 10,
  };
}

async function timedSearch(query, clientAddress, coldConnection = false) {
  const started = performance.now();
  const response = await fetch(`${origin}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Forwarded-For": clientAddress,
      ...(coldConnection ? { "Cache-Control": "no-cache", Connection: "close" } : {}),
    },
    body: JSON.stringify({ query, limit: 20 }),
  });
  if (!response.ok) throw new Error(`search corpus failed with ${response.status}`);
  await response.arrayBuffer();
  return performance.now() - started;
}

async function measureSearchP95() {
  const corpus = ["91001", "밤의", "ㅂㅇ ㅊㅋㅇ", "없는 노래"];
  const benchmarkClients = {
    coldSequential: "198.18.0.1",
    warmSequential: "198.18.0.2",
    concurrentFour: "198.18.0.3",
  };
  const coldSequential = [];
  const warmSequential = [];
  const concurrentFour = [];
  for (let repeat = 0; repeat < 10; repeat += 1) {
    for (const query of corpus) {
      coldSequential.push(await timedSearch(query, benchmarkClients.coldSequential, true));
    }
  }
  for (let repeat = 0; repeat < 10; repeat += 1) {
    for (const query of corpus) {
      warmSequential.push(await timedSearch(query, benchmarkClients.warmSequential));
    }
  }
  for (let repeat = 0; repeat < 10; repeat += 1) {
    concurrentFour.push(
      ...(await Promise.all(
        corpus.map((query) => timedSearch(query, benchmarkClients.concurrentFour)),
      )),
    );
  }
  const cold = latencySummary(coldSequential);
  const warm = latencySummary(warmSequential);
  const concurrent = latencySummary(concurrentFour);
  return {
    subject: {
      region: "local loopback",
      catalogRows: 12,
      corpus,
      repeats: 10,
      cold: "HTTP connection close + no-cache",
      warm: "keep-alive, no application cache",
      concurrency: [1, 4],
      clientBuckets:
        "three RFC 2544 benchmark addresses; 40 requests per documented 60/minute bucket",
    },
    coldSequential: cold,
    warmSequential: warm,
    concurrentFour: concurrent,
    p95Ms: Math.max(cold.p95Ms, warm.p95Ms, concurrent.p95Ms),
  };
}

async function measureCalculation(browser) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(observerBootstrap);
  const page = await context.newPage();
  await configurePage(context, page);
  await page.goto(`${origin}/search`, { waitUntil: "networkidle" });
  const search = page.getByLabel("제목, 가수 또는 노래방 번호");
  await search.fill("밤의 체크인");
  const result = page.getByRole("listitem").filter({ hasText: "밤의 체크인" }).first();
  await result.getByRole("button", { name: /담기/u }).click();
  await page.getByRole("link", { name: "플랜 보기" }).click();
  await page.getByRole("button", { name: "요금과 인원 입력하기" }).click();
  await page.getByLabel("나눌 인원").fill("2");

  const latencies = [];
  for (let index = 0; index < repetitions; index += 1) {
    if (index > 0) {
      await page.locator("details.pricing-disclosure > summary").click();
    }
    await page.getByLabel("낱곡 가격 (원)").fill(String(1_000 + index));
    const latency = await page.evaluate(async () => {
      const before = document.querySelector(".calculation-dl")?.textContent ?? "";
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === "계산에 적용",
      );
      if (!button) throw new Error("calculation submit button is unavailable");
      const started = performance.now();
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("calculation result did not update"));
        }, 2_000);
        const observer = new MutationObserver(() => {
          const after = document.querySelector(".calculation-dl")?.textContent ?? "";
          if (after === before) return;
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve(undefined);
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
        button.click();
      });
      return performance.now() - started;
    });
    latencies.push(latency);
  }
  const ticketStarted = Date.now();
  await page.getByRole("button", { name: "1곡 티켓 만들기" }).click();
  await page.waitForURL(/\/ticket$/u);
  await page.getByRole("heading", { name: "오늘의 세션 스트립" }).waitFor();
  const ticketNavigationMs = Date.now() - ticketStarted;
  const ticketMetrics = await readPageMetrics(page);
  await context.close();
  return {
    calculationMs: distribution(latencies.map((value) => Math.round(value * 10) / 10)),
    ticketNavigationMs,
    ticketLongTasksOver50Ms: ticketMetrics.longTasksOver50Ms,
  };
}

let browser;
try {
  await waitUntilReady();
  browser = await chromium.launch({ headless: true });
  const cold = await measureNavigation(browser, true);
  const warm = await measureNavigation(browser, false);
  const search = await measureSearchP95();
  const interaction = await measureCalculation(browser);
  const report = {
    profile: "fixture production artifact",
    conditions: {
      browser: "Playwright Chromium",
      cpuSlowdown: 4,
      network: "40ms RTT, 10Mbps down, 5Mbps up",
      samples: repetitions,
      cache: { cold: "cleared context/cache", warm: "same context HTTP cache" },
    },
    cold: summarizeNavigation(cold),
    warm: summarizeNavigation(warm),
    search,
    interaction,
    fieldP75: "NOT_RUN + NONE",
  };
  if (cold.some((sample) => sample.lcpMs <= 0) || warm.some((sample) => sample.lcpMs <= 0)) {
    throw new Error("LCP observer did not produce all required samples");
  }
  if (search.p95Ms > 800) throw new Error(`search p95 exceeded 800ms: ${search.p95Ms}`);
  if (interaction.calculationMs.worst > 100) {
    throw new Error(`calculation interaction exceeded 100ms: ${interaction.calculationMs.worst}`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser?.close();
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}
