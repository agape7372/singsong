/**
 * 일회용 캡처. `public/og/ticket-1200x630.png` 를 만들고 나면 이 파일은 지운다.
 *
 * 왜 테스트로 뽑나: 라우트가 Next 런타임 밖에서도 도는 순수 함수라 dev 서버·pnpm·Supabase
 * 없이 부를 수 있고, vitest 가 이미 이 repo 의 유일하게 동작하는 실행기다.
 * (`npm run dev` 는 pnpm 셸아웃이라 이 PC 에서 실패한다.)
 *
 * 실행: node node_modules/vitest/vitest.mjs run tests/integration/og-capture.test.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, expect, it } from "vitest";

// 라우트의 슬러그 정규식을 통과해야 한다. 통과하지 못하면 조용히 "열 수 없는 링크" 카드가
// 나오는데 PNG 매직바이트 검사만으로는 green 이 되어버린다.
const VALID_SLUG = "AAAAAAAAAAAAAAAAAAAAAA";

beforeAll(() => {
  process.env.APP_PROFILE = "fixture";
  process.env.NEXT_PUBLIC_APP_PROFILE = "fixture";
});

it("captures the static brand OG image", async () => {
  const { GET } = await import("@/app/api/og/[slug]/route");

  const response = await GET(new Request(`http://localhost:3000/api/og/${VALID_SLUG}?brand=1`), {
    params: Promise.resolve({ slug: VALID_SLUG }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());

  expect(response.status).toBe(200);
  const metadata = await sharp(bytes).metadata();
  expect(metadata).toMatchObject({ format: "png", width: 1_200, height: 630 });

  // 브랜드판인지 "열 수 없는 링크" 카드인지 픽셀로 판별한다. 후자는 로즈가 킥커 몇 글자뿐이다.
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  let rose = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset]!;
    const green = data[offset + 1]!;
    const blue = data[offset + 2]!;
    if (red > 200 && green < 120 && blue > 60 && blue < 190) rose += 1;
  }
  expect(rose, "로즈 픽셀 — 브랜드 마크가 커야 한다").toBeGreaterThan(20_000);

  // 컴포지션 그레인이 실려 있어야 한다(완전 평면이면 stdev 0).
  const stub = await sharp(bytes).extract({ left: 700, top: 80, width: 400, height: 200 }).stats();
  expect(stub.channels.some((channel) => channel.stdev > 1)).toBe(true);

  const directory = path.join(process.cwd(), "public", "og");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "ticket-1200x630.png"), bytes);
});
