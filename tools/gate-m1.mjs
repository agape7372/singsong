#!/usr/bin/env node
/**
 * M1 헤드리스 게이트 — `node tools/gate-m1.mjs`
 *
 * 정본 계획 §4 M1 게이트: "Node 스크립트 1개가 React·기기 없이 플랜 생성 → 100곡 →
 * 계산 → 티켓 동결 → canonical fingerprint 출력."
 *
 * ★ 이 게이트가 증명하는 것은 "맨 Node 에서 그대로 돈다" 가 **아니다**. 도메인·스토어
 *   소스는 확장자 없는 상대 import(`from "./models"`)를 쓴다 — TS `moduleResolution:
 *   "bundler"` 와 vite/webpack/Metro 는 풀지만 Node ESM 은 `ERR_MODULE_NOT_FOUND` 로
 *   죽는다(오케스트레이터 실측, ORCHESTRATOR-NOTES §트랙E 6). 그래서 아래 resolve 훅이
 *   확장자만 붙여 준다. 증명 문구는 정확히 이것이다:
 *   **"번들러 없이 순수 Node + 확장자 리졸버 shim 만으로 도메인·스토어가 돈다."**
 *
 * 이 조건이 vitest 로는 안 나온다. vitest 는 esbuild 로 TS 를 변환하고 `@/domain` 별칭을
 * 풀어 준다(vitest.config.ts) — 즉 "번들러가 있는 세계"만 본다. 여기엔 별칭이 없고, 맨
 * Node 가 워크스페이스 심링크와 exports 맵으로 패키지를 찾고, 플랫폼 전역(`crypto`·
 * `TextEncoder`)이 아니라 **주입된 포트**로 난수·해시·시각을 얻는지까지 확인한다.
 *
 * ── 왜 플래그가 붙는가 (전부 Node v24.11.1 에서 실행해 확인) ─────────────────
 *
 * `--experimental-transform-types`
 *   Node 24 는 타입 스트리핑이 기본 켜짐이라 보통은 필요 없다. 그런데
 *   `packages/domain/src/validation.ts` 의 생성자 파라미터 프로퍼티
 *   (`constructor(readonly code: string, …)`)를 strip-only 모드가
 *   `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` 로 거절한다 — 네 패키지 통틀어 이 한 곳뿐이다.
 *   그 줄이 평범한 필드 대입으로 바뀌면 이 플래그를 지울 수 있다.
 *
 * `--experimental-sqlite`
 *   `node:sqlite` 는 Node 22 라인에서 이 플래그 뒤에 있었다. Node 24 에서는 no-op 이라
 *   손해가 0 이고(실측), CI 가 `.nvmrc` 상향 전 22.x 로 돌 여지를 방어한다(crit §C2).
 *
 * `--disable-warning=ExperimentalWarning`
 *   위 둘과 `node:sqlite` 가 각각 ExperimentalWarning 을 stderr 로 뱉는다. 여기는 사람이
 *   PASS/FAIL 을 읽는 화면이라 잡음을 없앤다.
 *
 * 플래그 없이 부르면 아래 재실행 가드가 스스로 붙여 다시 띄운다.
 *
 * 종료 코드: 통과 0 / 실패 1.  옵션: `--history` — 도메인 이동 커밋 R100 검사 추가(로컬 전용).
 */

import { spawnSync } from "node:child_process";
import { createHash, randomBytes as nodeRandomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(HERE), "..");

/* ─────────────────────── 0. 기능 탐지 (crit §C1) ─────────────────────── */

// ★ namespace import 로 집는다. 정적 `import { registerHooks }` 였다면 registerHooks 가
//   없는 Node(22.13)에서 **모듈 인스턴스화 시점 SyntaxError** 로 죽어, 아래 안내가 영원히
//   도달 불가였다(crit §C1 실측). namespace import 는 없는 이름을 undefined 로 둘 뿐이다.
//   그래서 이 검사를 재실행 가드보다 **앞**에 둔다 — 버전 산술이 아니라 기능 탐지다.
const registerHooks = nodeModule.registerHooks;
if (typeof registerHooks !== "function") {
  console.error(
    "`module.registerHooks` 가 없다 (Node 22.15+ 필요).\n" +
      "  → 확장자 없는 상대 import 를 풀 방법이 없어 이 게이트는 뜨지도 못한다.\n" +
      "  → Node 22.18 LTS 이상 또는 24 로 올려라. `.nvmrc`(22.13) 로는 못 돈다.",
  );
  process.exit(1);
}

/* ─────────────────────── 1. 필요한 플래그로 재실행 ─────────────────────── */

const REQUIRED_FLAGS = [
  "--experimental-transform-types",
  "--experimental-sqlite",
  "--disable-warning=ExperimentalWarning",
];

if (!process.env.SINGSONG_GATE_CHILD) {
  const missing = REQUIRED_FLAGS.filter((flag) => !process.execArgv.includes(flag));
  if (missing.length > 0) {
    const child = spawnSync(process.execPath, [...REQUIRED_FLAGS, HERE, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, SINGSONG_GATE_CHILD: "1" },
    });
    process.exit(child.status ?? 1);
  }
}

/* ─────────────────────── 2. TS resolve 훅 ─────────────────────── */

// 확장자 없는 상대 specifier 에 `.ts` / `/index.ts` 만 붙인다. **별칭은 만들지 않는다** —
// 훅이 Metro 보다 많은 일을 하기 시작하면 이 게이트는 증명력을 잃는다.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const extension of [".ts", "/index.ts"]) {
        const candidate = new URL(base.href + extension);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

/* ─────────────────────── 3. 판정 프레임 ─────────────────────── */

const failures = [];
let passCount = 0;

/** 검사 하나. `run` 은 통과면 부가 설명 문자열, 실패면 throw. */
async function check(label, run) {
  try {
    const note = await run();
    passCount += 1;
    console.log(`  PASS  ${label}${note ? ` — ${note}` : ""}`);
  } catch (error) {
    // DomainValidationError 는 `code` 에 진짜 원인이 있고 `message` 는 산문이다.
    // 코드를 안 찍으면 "shared snapshot schema is invalid" 만 여러 줄 반복된다.
    const message = error.code ? `[${error.code}] ${error.message}` : error.message;
    failures.push({ label, message });
    console.log(`  FAIL  ${label}`);
    for (const line of String(message).split("\n")) console.log(`        ${line}`);
  }
}

const fail = (message) => {
  throw new Error(message);
};

const show = (value) => (typeof value === "object" ? JSON.stringify(value) : String(value));

/** 고정값 대조. 어긋나면 기대·실제를 **둘 다** 찍는다 — 지문은 눈으로 못 고친다. */
function pin(label, actual, expected) {
  const same =
    typeof expected === "object"
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected;
  if (!same) {
    fail(
      `${label} 이 고정값과 다르다.\n` +
        `  기대: ${show(expected)}\n` +
        `  실제: ${show(actual)}\n` +
        `  → 도메인 직렬화(키 순서·base64url·UTF-8 인코딩·반올림) 중 하나가 바뀌었다. ` +
        `의도한 변경이면 이 파일의 PIN 을 다시 실측해 갱신하고 커밋 메시지에 이유를 남겨라. ` +
        `의도하지 않았다면 공유 링크와 서버 재검증이 조용히 어긋난 것이다.`,
    );
  }
}

/** `run` 이 던지기를 기대한다. 안 던지면 실패. 전역 폴백이 없다는 것을 행동으로 증명한다. */
async function expectThrow(label, run) {
  try {
    await run();
  } catch {
    return; // 기대대로 던졌다
  }
  fail(`${label} 이 던지지 않았다 — 인자 없이도 도는 전역 폴백이 남아 있다.`);
}

/* ─────────────────────── 4. 픽스처 (정본) ─────────────────────── */

/**
 * 아래 PIN 값들은 이 픽스처에 **바이트 단위로** 매달려 있다. 픽스처를 한 글자라도 바꾸면
 * PIN 을 다시 실측해야 한다. 그래서 둘을 한 화면 안에 붙여 둔다.
 *
 * ★ Clock 은 epoch 밀리초다(ports.ts:28, `Clock = () => number`). 스펙 초안은 now() 를
 *   ISO 문자열로 봤으나 트랙 A 가 랜딩한 계약은 number 다. createTicketSnapshot 은
 *   `new Date(ports.now()).toISOString()`(canonical.ts:167)로 문자열을 만든다.
 */
const FIXED_NOW_ISO = "2026-01-02T03:04:05.000Z";
const FIXED_NOW_MS = Date.parse(FIXED_NOW_ISO);

/** 결정론 시드. 상수 배열 대신 식으로 두어 손으로 전사할 여지를 없앤다. */
const fixedSeedBytes = (byteLength) =>
  Uint8Array.from({ length: byteLength }, (_, i) => (i * 17) % 256);

function makeTrack(order) {
  const n = String(order + 1).padStart(3, "0");
  // 3주기로 코드 0·1·2개를 섞는다. 빈 배열과 벤더 2종을 한 픽스처에서 함께 태운다.
  const karaokeCodes =
    order % 3 === 0
      ? [{ vendor: "TJ", code: String(10000 + order) }]
      : order % 3 === 1
        ? [
            { vendor: "TJ", code: String(10000 + order) },
            { vendor: "KY", code: String(20000 + order) },
          ]
        : [];
  return {
    id: `gate-track-${n}`,
    source: order % 2 === 0 ? "catalog" : "manual",
    catalogSongId: order % 2 === 0 ? `catalog-${n}` : null,
    // 한글을 쓰는 이유: 캐노니컬 바이트 수와 지문이 UTF-8 인코더에 실제로 의존하게 만든다.
    // 트랙 A 가 `TextEncoder` 를 순수 TS 로 갈아끼울 때 3바이트 분기 누락을 여기서 잡는다.
    title: `테스트 곡 ${n}`,
    artist: `가수 ${(order % 7) + 1}`,
    karaokeCodes,
    order,
  };
}

const EMPTY_PLAN = {
  id: "gate-plan",
  revision: 0,
  createdAt: FIXED_NOW_ISO,
  updatedAt: FIXED_NOW_ISO,
  items: [],
  people: null,
  pricing: null,
};

// 번들 가격: 100곡의 최적해는 3곡 2,500원 묶음 33개 + 낱개 1곡 = 83,500원이다.
// 묶음 34개(85,000원)도 낱개 100곡(100,000원)도 아니다 — 최적화 루프가 실제로 도는지 본다.
const SONG_PRICING = { kind: "song", singlePriceWon: 1000, bundle: { songs: 3, priceWon: 2500 } };
const TIME_PRICING = { kind: "time", blockSeconds: 600, blockPriceWon: 2000 };

const FULL_PLAN = {
  ...EMPTY_PLAN,
  revision: 1,
  items: Array.from({ length: 100 }, (_, order) => makeTrack(order)),
  people: 4,
  pricing: SONG_PRICING,
};

/* ── 실측 고정값. `node tools/gate-m1.mjs` 를 돌려 얻은 값만 여기 적는다. ──
 *
 * ★ 이 값들이 카나리로 지키는 것: 도메인의 canonical 직렬화(JSON 키 순서 + 순수 base64url
 *   + 순수 UTF-8 인코딩 + 가격/구간 반올림)가 바뀌지 않았음. 지문은 plan.id·revision·
 *   createdAt 에 의존하지 않으므로(canonical.ts 가 로컬 id 를 떨군다) 트랙 A/C 이후에도
 *   같은 값이어야 한다 — 트랙 A 가 인코더를 순수 TS 로 갈았어도 출력 바이트가 같다는 뜻.
 *   하나라도 달라지면 공유 링크(클라 발권 지문 ↔ 서버 재검증 지문)가 조용히 갈린 것이다.
 */
const PIN = {
  artworkSeed: "ABEiM0RVZneImaq7zN3u_w",
  duration: {
    modelVersion: "fallback-v1",
    lowSec: 17985,
    midpointSec: 23475,
    highSec: 28965,
    coverageBps: 0,
  },
  displayDuration: { lowMinutes: 295, highMinutes: 485 },
  songDerived: {
    totalLowWon: 83500,
    totalHighWon: 83500,
    perPersonLowWon: 20875,
    perPersonHighWon: 20875,
  },
  timeDerived: {
    totalLowWon: 60000,
    totalHighWon: 98000,
    perPersonLowWon: 15000,
    perPersonHighWon: 24500,
  },
  canonicalBytes: 13180,
  songFingerprint: "35e480231e6546ae44ac3ac3eb2508a0a4b074733bc92b47fc0c0d0f31bcf59f",
  timeFingerprint: "f558b599c499d9e39939b7604a26c8f713a99a161c5d40ddf485fd7d688b7d6a",
};

/* ─────────────────────── 5. 포트 ─────────────────────── */

const sha256 = async (bytes) => new Uint8Array(createHash("sha256").update(bytes).digest());

/**
 * 결정론 DomainPorts. 호출 계수를 함께 들고 다닌다 — 포트를 **받기만 하고 쓰지 않는**
 * 구현을 잡기 위해서다. 시그니처만 `(plan, ports)` 로 바꾸고 안에서는 여전히 전역
 * `crypto.subtle`·`new Date()` 를 부르면 지문은 맞는데 기기에서는 죽는다.
 * ★ DomainPorts 는 `{ randomBytes, digest, now }` 뿐이다(ports.ts:34-38, randomId 제외).
 */
function deterministicPorts(overrides = {}) {
  const calls = { randomBytes: 0, digest: 0, now: 0 };
  return {
    calls,
    ports: {
      randomBytes(byteLength) {
        calls.randomBytes += 1;
        return fixedSeedBytes(byteLength);
      },
      async digest(bytes) {
        calls.digest += 1;
        return sha256(bytes);
      },
      now() {
        calls.now += 1;
        return FIXED_NOW_MS;
      },
      ...overrides,
    },
  };
}

/** 실난수 DomainPorts. 형식·유일성 검사용. */
const livePorts = () => ({
  randomBytes: (byteLength) => new Uint8Array(nodeRandomBytes(byteLength)),
  digest: sha256,
  now: () => Date.now(),
});

/** StorePorts = { now, randomBytes, randomId }(store/src/ports.ts:26-28). now 는 epoch ms. */
const storePorts = () => ({
  now: () => FIXED_NOW_MS,
  randomBytes: (byteLength) => new Uint8Array(nodeRandomBytes(byteLength)),
  randomId: () => randomUUID(),
});

/* ─────────────────────── 6. 실행 ─────────────────────── */

const wantHistory = process.argv.includes("--history");
const readJson = (relative) => JSON.parse(readFileSync(resolve(ROOT, relative), "utf8"));
const report = {};

console.log(`\n싱송 M1 헤드리스 게이트 — ${ROOT}`);
console.log(`Node ${process.version} · transform-types · 번들러 없음(리졸버 shim 만)\n`);

let domain;

await main();

async function main() {
  await check("런타임 전제 — 맨 Node, DOM 없음, React 의존 0건", async () => {
    await import("node:sqlite"); // 없으면 throw → store 왕복 자체가 불가. 안내는 아래.

    for (const name of ["window", "document", "localStorage", "indexedDB"]) {
      if (globalThis[name] !== undefined) fail(`전역 \`${name}\` 이 있다 — 맨 Node 가 아니다.`);
    }
    // ★ 네 패키지 전부 본다(M3). domain·store 만 보면 tokens·ticket-art 의 프레임워크 오염을 놓친다.
    for (const pkg of ["domain", "store", "tokens", "ticket-art"]) {
      const manifest = readJson(`packages/${pkg}/package.json`);
      const banned = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter(
        (dep) => /^(react|react-dom|react-native|expo)(-|$|\/)/.test(dep),
      );
      if (banned.length > 0) {
        fail(
          `packages/${pkg} 이 ${banned.join(", ")} 에 의존한다.\n` +
            `  → 이 패키지들은 서버·Node·기기 어디서나 같은 코드로 돌아야 한다. ` +
            `프레임워크 의존은 apps/app 으로 올려라.`,
        );
      }
    }
    return `${process.version} · DOM 전역 0건 · 4패키지 프레임워크 의존 0건`;
  });

  await check("도메인 로드 — 워크스페이스 심링크 + exports 맵", async () => {
    domain = await import("@singsong/domain");
    const required = [
      "DOMAIN_LIMITS",
      "assertValidPlan",
      "calculatePlan",
      "buildSharedSnapshot",
      "serializeSharedSnapshot",
      "fingerprintSharedSnapshot",
      "generateArtworkSeed",
      "isCanonicalArtworkSeed",
      "createTicketSnapshot",
    ];
    const missing = required.filter((name) => domain[name] === undefined);
    if (missing.length > 0)
      fail(`@singsong/domain 이 ${missing.join(", ")} 를 export 하지 않는다.`);

    // ★ arity(createTicketSnapshot.length === 2) 검사는 넣지 않는다(crit §C4). 트랙 A 가
    //   `createTicketSnapshot(plan, ports = webPorts)` 처럼 기본 인자를 주면 arity 가 1 이
    //   되어 정당한 DI 구현이 실격된다. DI 는 아래 leg(결정론 지문·센티널·순수함수 행동)이
    //   **행동으로** 증명한다 — 시그니처 모양이 아니라 포트가 실제로 불렸는지를 본다.

    // 서브패스 exports(`"./*": "./src/*.ts"`)도 함께 태운다. `josa.ts` 는 배럴(index.ts:1-8)
    // 에서 재수출되지 않아 **이 경로로만** 닿고, exports 맵 해석은 Node 와 Metro 가 서로 다른
    // 구현이라 한쪽에서만 깨질 수 있다.
    const { josa } = await import("@singsong/domain/josa");
    if (josa("밤의 체크인", "을/를") !== "을")
      fail("서브패스 export `@singsong/domain/josa` 가 이상하다.");

    return `export ${Object.keys(domain).length}종 · 서브패스 josa ok`;
  });

  // ★ M4: 도메인 로드가 실패하면 이후 leg 은 전부 "domain 이 undefined" 라는 파생 오류로
  //   무너진다. 원인 한 줄을 아홉 줄에 묻지 않도록 여기서 멈춘다.
  if (domain === undefined) {
    console.log("\n  (도메인 로드 실패 — 이후 검사를 건너뛴다. 위 FAIL 한 줄이 원인이다.)");
    return;
  }

  await check("패키지 로드 — tokens·ticket-art 도 맨 Node 에서 뜬다", async () => {
    // M2: M1 산출물 4개가 모두 번들러 없이 로드되는지. ticket-art 는 JSON 을 import 하므로
    //   Node ESM 이 import attribute(`with { type: "json" }`)를 요구한다 — 없으면 여기서
    //   `ERR_IMPORT_ATTRIBUTE_MISSING`. tokens 는 순수 TS 다.
    const tokens = await import("@singsong/tokens");
    if (Object.keys(tokens).length === 0) fail("@singsong/tokens 가 아무것도 export 하지 않는다.");
    const ticketArt = await import("@singsong/ticket-art");
    if (typeof ticketArt.ARTWORK !== "object" || ticketArt.ARTWORK === null)
      fail("@singsong/ticket-art 의 ARTWORK 가 로드되지 않았다.");
    if (typeof ticketArt.buildTicketScene !== "function")
      fail("@singsong/ticket-art 가 buildTicketScene 을 export 하지 않는다.");
    return `tokens export ${Object.keys(tokens).length}종 · ticket-art ARTWORK+scene ok`;
  });

  await check("순수 함수 DI — 전역 폴백 없음 (Hermes 구멍 직접 봉인)", async () => {
    // ★ M1: 아래 "티켓 동결" leg 은 createTicketSnapshot 경로만 본다. 그러나 핸드오프가
    //   지목한 런타임 구멍은 generateArtworkSeed(canonical.ts:26)·fingerprintSharedSnapshot
    //   (:138) 이라는 **낱개 함수**에 있다. 여기서 그 둘을 직접 태운다.
    //   arity 가 아니라 행동으로 검사한다(crit §M1) — 기본 인자가 다시 생기면 "인자 없이도
    //   돈다"가 참이 되어 이 검사가 잡는다.
    const seed = domain.generateArtworkSeed(() => fixedSeedBytes(16));
    pin("generateArtworkSeed(주입 randomBytes)", seed, PIN.artworkSeed);
    await expectThrow("generateArtworkSeed()", () => domain.generateArtworkSeed());

    const payload = (await domain.createTicketSnapshot(FULL_PLAN, deterministicPorts().ports))
      .payload;
    // 센티널 digest: 32바이트 0xAB. 지문이 "abab…" 가 아니면 주입 digest 로 라우팅 안 된 것.
    const sentinel = await domain.fingerprintSharedSnapshot(payload, async () =>
      new Uint8Array(32).fill(0xab),
    );
    pin("fingerprintSharedSnapshot(센티널 digest)", sentinel, "ab".repeat(32));
    await expectThrow("fingerprintSharedSnapshot(payload)", () =>
      domain.fingerprintSharedSnapshot(payload),
    );
    return "generateArtworkSeed·fingerprintSharedSnapshot 둘 다 포트 필수";
  });

  await check("플랜 생성 — 빈 플랜은 유효한 편집 상태, 발권은 아직 불가", () => {
    // 빈 플랜과 null 설정은 합법적인 편집 상태다(models.ts:45-49).
    domain.assertValidPlan(EMPTY_PLAN, false);

    // ★ 순서가 중요하다. `assertValidPlan` 은 트랙 수를 먼저 본다(validation.ts:144).
    //   그래서 **빈** 플랜은 PLAN_NOT_READY 가 아니라 INVALID_TRACK_COUNT 로 막힌다.
    //   사람 수·가격 누락을 보려면 곡이 최소 1개 있어야 한다. 두 경로는 화면에서 서로 다른
    //   안내로 갈리므로 코드까지 고정한다.
    expectRejection("곡 0개 플랜", EMPTY_PLAN, "INVALID_TRACK_COUNT");
    expectRejection(
      "곡은 있고 사람 수·가격이 없는 플랜",
      { ...EMPTY_PLAN, items: [makeTrack(0)] },
      "PLAN_NOT_READY",
    );
    return "빈 플랜 편집 가능 · INVALID_TRACK_COUNT / PLAN_NOT_READY 분리";
  });

  await check("100곡 — 상한 경계와 그 바로 바깥", () => {
    pin("DOMAIN_LIMITS.maxTracks", domain.DOMAIN_LIMITS.maxTracks, 100);
    domain.assertValidPlan(FULL_PLAN, true);
    expectRejection(
      "101곡",
      { ...FULL_PLAN, items: [...FULL_PLAN.items, makeTrack(100)] },
      "INVALID_TRACK_COUNT",
    );
    expectRejection(
      "order 가 끊긴 플랜",
      { ...FULL_PLAN, items: FULL_PLAN.items.map((t, i) => (i === 50 ? { ...t, order: 99 } : t)) },
      "NON_CONTIGUOUS_ORDER",
    );
    return "100 통과 · 101 거부 · 비연속 order 거부";
  });

  await check("계산 — 구간·표시·파생 전 항목 고정값", () => {
    const calculation = domain.calculatePlan(
      FULL_PLAN.items.length,
      FULL_PLAN.pricing,
      FULL_PLAN.people,
    );
    pin("duration", calculation.duration, PIN.duration);
    pin("displayDuration", calculation.displayDuration, PIN.displayDuration);
    pin("derived", calculation.derived, PIN.songDerived);
    return `100곡 · ${FULL_PLAN.people}인 · 합계 ${PIN.songDerived.totalLowWon}원 · 1인 ${PIN.songDerived.perPersonLowWon}원`;
  });

  await check("티켓 동결 (결정론 ports) — canonical fingerprint 고정", async () => {
    const { ports, calls } = deterministicPorts();
    const ticket = await domain.createTicketSnapshot(FULL_PLAN, ports);

    pin("artworkSeed", ticket.artworkSeed, PIN.artworkSeed);
    pin("createdAt", ticket.createdAt, FIXED_NOW_ISO); // new Date(FIXED_NOW_MS).toISOString()
    pin(
      "canonical 바이트 수",
      new TextEncoder().encode(ticket.canonicalPayload).byteLength,
      PIN.canonicalBytes,
    );
    pin("fingerprint", ticket.fingerprint, PIN.songFingerprint);

    if (ticket.canonicalPayload !== domain.serializeSharedSnapshot(ticket.payload)) {
      fail("canonicalPayload 가 payload 를 다시 직렬화한 결과와 다르다 — 티켓이 자기모순이다.");
    }
    if (ticket.planId !== FULL_PLAN.id || ticket.revision !== FULL_PLAN.revision) {
      fail("티켓이 플랜 신원을 잃었다.");
    }
    if (ticket.issueMotionClaimedAt !== null) {
      fail("갓 만든 티켓의 issueMotionClaimedAt 은 null 이어야 한다.");
    }
    // 공유 스냅샷은 공개 역량 페이로드다. 로컬 id 가 새면 링크 하나로 기기가 상관된다.
    if (
      ticket.canonicalPayload.includes(FULL_PLAN.id) ||
      ticket.canonicalPayload.includes("gate-track-")
    ) {
      fail("캐노니컬 payload 에 로컬 식별자가 샜다 — 공유 스냅샷은 plan/track id 를 담지 않는다.");
    }

    report.artworkSeed = ticket.artworkSeed;
    report.canonicalBytes = new TextEncoder().encode(ticket.canonicalPayload).byteLength;
    report.songFingerprint = ticket.fingerprint;
    return `포트 호출 randomBytes ${calls.randomBytes} · digest ${calls.digest} · now ${calls.now}`;
  });

  await check("DI 이음매 — 포트가 장식이 아니라 실제 경로", async () => {
    const { ports, calls } = deterministicPorts();
    await domain.createTicketSnapshot(FULL_PLAN, ports);
    // DomainPorts 셋 전부 발권 경로에서 불려야 한다(ports.ts:34-38).
    const dead = ["randomBytes", "digest", "now"].filter((name) => calls[name] === 0);
    if (dead.length > 0) {
      fail(
        `포트 ${dead.join(", ")} 가 한 번도 불리지 않았다.\n` +
          `  → 시그니처만 \`(plan, ports)\` 로 바꾸고 안에서는 여전히 전역 crypto·Date 를 ` +
          `부르고 있다. 지문은 맞지만 Hermes 에서는 첫 사용에 TypeError 다.`,
      );
    }

    // 센티널: 32바이트 0xAB 를 돌려주는 digest. 지문이 "abab…" 가 아니면 라우팅이 안 된 것이다.
    const sentinel = deterministicPorts({ digest: async () => new Uint8Array(32).fill(0xab) });
    const ticket = await domain.createTicketSnapshot(FULL_PLAN, sentinel.ports);
    pin("센티널 digest 지문", ticket.fingerprint, "ab".repeat(32));
    return "randomBytes·digest·now 전부 주입 경로";
  });

  await check("시간제 가격 모델 — 두 번째 고정 지문", async () => {
    const timePlan = { ...FULL_PLAN, pricing: TIME_PRICING };
    pin(
      "시간제 derived",
      domain.calculatePlan(100, TIME_PRICING, timePlan.people).derived,
      PIN.timeDerived,
    );
    const { ports } = deterministicPorts();
    const ticket = await domain.createTicketSnapshot(timePlan, ports);
    pin("시간제 fingerprint", ticket.fingerprint, PIN.timeFingerprint);
    report.timeFingerprint = ticket.fingerprint;
    return `블록 ${TIME_PRICING.blockSeconds}초 · ${PIN.timeDerived.totalLowWon}~${PIN.timeDerived.totalHighWon}원`;
  });

  const ROUNDS = 32;
  await check(`티켓 동결 (실난수 ×${ROUNDS}) — 형식과 유일성`, async () => {
    const seeds = new Set();
    const fingerprints = new Set();
    for (let round = 0; round < ROUNDS; round += 1) {
      const ticket = await domain.createTicketSnapshot(FULL_PLAN, livePorts());
      if (!domain.isCanonicalArtworkSeed(ticket.artworkSeed)) {
        fail(`artworkSeed \`${ticket.artworkSeed}\` 가 캐노니컬 base64url 22자가 아니다.`);
      }
      if (!/^[a-f0-9]{64}$/u.test(ticket.fingerprint)) {
        fail(`fingerprint \`${ticket.fingerprint}\` 가 소문자 hex 64자가 아니다.`);
      }
      if (!Number.isFinite(Date.parse(ticket.createdAt))) {
        fail(`createdAt \`${ticket.createdAt}\` 이 파싱되지 않는다.`);
      }
      seeds.add(ticket.artworkSeed);
      fingerprints.add(ticket.fingerprint);
    }
    if (seeds.size !== ROUNDS || fingerprints.size !== ROUNDS) {
      fail(
        `${ROUNDS}회 중 seed ${seeds.size}종 / 지문 ${fingerprints.size}종.\n` +
          `  → randomBytes 포트가 상수를 돌려주고 있다. 같은 시드는 같은 아트워크이고, ` +
          `공유 링크에서는 서로 다른 세션이 같은 지문으로 충돌한다.`,
      );
    }
    return `seed ${seeds.size}종 · 지문 ${fingerprints.size}종 전부 유일`;
  });

  await check("store 왕복 — openPlanStore → mutate → 재수화 → 같은 지문", async () => {
    const store = await import("@singsong/store");
    // ★ 테스트 디렉터리를 넘어다본다. `node-sql-executor` 는 계약 테스트용 두 번째 구현이고
    //   이 게이트가 두 번째 소비자다. 트랙 C 가 store 를 손볼 때 `src/testing/` 으로 올리고
    //   exports 맵(`./testing`)에 실어라 — 소비자가 둘이면 더는 테스트 사유물이 아니다.
    const { createNodeSqlExecutor } = await import("../packages/store/test/node-sql-executor.ts");

    // ★ raw SQL 이 아니라 **정본 진입점 openPlanStore** 를 태운다(팀리드 결정). 뮤텍스·트랜잭션·
    //   마이그레이션·JSON TEXT 왕복·재수화 — 트랙 C 가 실제로 짠 repository 경로 전부가 여기서
    //   돈다. vitest 마이그레이션 테스트는 `'[]'`·`'{}'` 합성 행만 넣어 이 경로를 안 본다.
    const planStore = await store.openPlanStore(createNodeSqlExecutor(), storePorts());
    try {
      // openPlanStore 가 빈 활성 플랜(revision 0)을 이미 재수화해 뒀다(plan-store.ts:96-103).
      const initial = await store.getActivePlan(planStore);

      // 100곡·4인·곡당가격으로 채운다. mutation 은 id/revision/createdAt/updatedAt 을 스토어가
      //  관리하므로 { items, people, pricing } 만 돌려준다(plan-store.ts:131-135).
      const mutated = await store.mutateActivePlan(planStore, initial.revision, () => ({
        items: FULL_PLAN.items,
        people: FULL_PLAN.people,
        pricing: FULL_PLAN.pricing,
      }));

      // 발권 → 저장. mutated.id 는 스토어의 ACTIVE_PLAN_ID, revision 은 1 이다. 지문은 로컬
      // id·revision 에 의존하지 않으므로(canonical) FULL_PLAN 직접 발권과 같은 값이어야 한다.
      const ticket = await domain.createTicketSnapshot(mutated, deterministicPorts().ports);
      pin("store 발권 지문(=FULL_PLAN 지문)", ticket.fingerprint, PIN.songFingerprint);
      await store.saveTicket(planStore, ticket);

      // 재수화: SQLite TEXT 를 한 바퀴 돈 플랜을 DB 에서 다시 읽는다(getActivePlan 은 캐시가
      // 아니라 readPlanRow 로 매번 조회한다 — plan-store.ts:117-129).
      const reread = await store.getActivePlan(planStore);
      // 한글 NFC·연속 order·벤더 중복 금지·빈 karaokeCodes·null catalogSongId 가 전부 여기서
      // 다시 걸린다.
      domain.assertValidPlan(reread, true);
      const replayed = await domain.createTicketSnapshot(reread, deterministicPorts().ports);
      if (replayed.fingerprint !== ticket.fingerprint) {
        fail(
          `왕복 후 지문이 달라졌다.\n` +
            `  저장 전:   ${ticket.fingerprint}\n` +
            `  재수화 후: ${replayed.fingerprint}\n` +
            `  → JSON 컬럼 왕복에서 무언가 소실됐다: 빈 karaokeCodes 배열, null catalogSongId, ` +
            `한글 정규화 중 하나가 유력하다.`,
        );
      }

      // 저장한 티켓도 그대로 읽히는가(planId + revision 유일).
      const storedTicket = await store.getTicket(planStore, ticket.planId, ticket.revision);
      if (!storedTicket) fail("저장한 티켓이 planId+revision 으로 읽히지 않는다.");
      if (
        storedTicket.fingerprint !== ticket.fingerprint ||
        storedTicket.canonicalPayload !== ticket.canonicalPayload
      ) {
        fail("ticket 행이 저장한 값과 다르게 읽힌다.");
      }
      return `active plan rev ${mutated.revision} · ticket 저장·재조회 · 재수화 지문 동일`;
    } finally {
      await store.closePlanStore(planStore);
    }
  });

  if (wantHistory) {
    await check("도메인 이동 커밋이 R100 (순수 이동)", () => {
      const MOVE_COMMIT = "023a5ce";
      const git = (...args) => spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });

      // ★ M5: git 저장소가 아니면 rev-parse 가 exit 128 + 빈 stdout 이다. stdout 만 보면
      //   shallow 분기를 지나쳐 다음 git show 실패를 "히스토리 재작성"으로 오진한다. status 를 먼저.
      const shallow = git("rev-parse", "--is-shallow-repository");
      if (shallow.status !== 0) {
        fail(
          "여기는 git 저장소가 아니다(rev-parse 실패).\n" +
            "  → `--history` 는 리포 워크트리에서만 쓴다.",
        );
      }
      // 얕은 클론에서는 과거를 볼 수 없다. 조용히 건너뛰면 게이트가 거짓말을 하므로 실패다.
      // 그래서 이 검사는 기본이 아니라 `--history` 오픈인 이다.
      if (shallow.stdout.trim() === "true") {
        fail(
          "얕은 클론이라 과거 커밋을 볼 수 없다.\n" +
            "  → CI 라면 actions/checkout 에 fetch-depth: 0 을 주거나 이 검사를 빼라.",
        );
      }
      const shown = git("show", "-M100%", "--name-status", "--format=", MOVE_COMMIT);
      if (shown.status !== 0) {
        fail(
          `커밋 ${MOVE_COMMIT} 을 찾을 수 없다 — 히스토리가 재작성됐다.\n` +
            `  → 스쿼시·리베이스로 이동 증거가 사라졌으면 이 검사를 지우거나 새 SHA 로 갱신하라. ` +
            `순수 이동이었다는 사실은 그 커밋 본문에도 적혀 있다.`,
        );
      }
      const lines = shown.stdout
        .split("\n")
        .filter((line) => line.includes("packages/domain/src/"));
      const renames = lines.filter((line) => line.startsWith("R100\t"));
      const impure = lines.filter((line) => !line.startsWith("R100\t"));
      if (renames.length !== 7 || impure.length > 0) {
        fail(
          `R100 ${renames.length}건(7 기대)` +
            (impure.length > 0 ? `, 순수 이동이 아닌 항목: ${impure.join(" / ")}` : "") +
            `.\n  → 도메인 이동이 내용 변경을 섞었다는 뜻이다.`,
        );
      }
      return `${MOVE_COMMIT} · R100 ×7`;
    });
  }
}

/** `assertValidPlan` 이 특정 코드로 거절하는지 본다. 통과해 버리면 그것도 실패다. */
function expectRejection(label, plan, code) {
  try {
    domain.assertValidPlan(plan, true);
    fail(`${label} 이 발권 가능으로 통과했다.`);
  } catch (error) {
    if (error.code !== code) fail(`${label}: ${code} 를 기대했는데 ${error.code ?? error.message}`);
  }
}

/* ─────────────────────── 7. 결과 ─────────────────────── */

console.log("");
if (report.songFingerprint) {
  console.log("  canonical fingerprint — 고정 시드, 고정 시각, 100곡");
  console.log(`    artworkSeed   ${report.artworkSeed}`);
  console.log(`    canonical     ${report.canonicalBytes} bytes`);
  console.log(`    곡당 가격     ${report.songFingerprint}`);
  if (report.timeFingerprint) console.log(`    시간제        ${report.timeFingerprint}`);
  console.log("");
}
if (failures.length === 0) {
  console.log(`통과 ${passCount}건, 실패 0건 — M1 헤드리스 코어 정상\n`);
  // ★ M6: process.exit 대신 exitCode. Windows 에서 stdout 이 파이프(CI 로그 수집)면
  //   console.log 직후 process.exit 이 마지막 줄을 자를 수 있다. 자연 종료가 안전하다.
  process.exitCode = 0;
} else {
  console.log(`통과 ${passCount}건, 실패 ${failures.length}건:`);
  for (const { label } of failures) console.log(`  - ${label}`);
  console.log("");
  process.exitCode = 1;
}
