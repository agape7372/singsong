import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

const rawOrigin = process.env.EXPO_PUBLIC_SHARE_API_ORIGIN?.trim();
if (!rawOrigin) {
  fail("EXPO_PUBLIC_SHARE_API_ORIGIN이 없습니다.");
} else {
  try {
    const origin = new URL(rawOrigin);
    if (origin.protocol !== "https:") fail("공유 origin은 HTTPS여야 합니다.");
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      fail("공유 origin은 자격 증명·경로·쿼리 없는 origin 값이어야 합니다.");
    }
    if (
      origin.hostname === "localhost" ||
      origin.hostname === "127.0.0.1" ||
      origin.hostname.endsWith(".local")
    ) {
      fail("릴리스 공유 origin은 로컬 주소일 수 없습니다.");
    }
  } catch {
    fail("EXPO_PUBLIC_SHARE_API_ORIGIN이 유효한 URL이 아닙니다.");
  }
}

for (const name of Object.keys(process.env)) {
  if (!name.startsWith("EXPO_PUBLIC_")) continue;
  if (/(SECRET|PRIVATE|SERVICE_ROLE|HMAC|REVOKE|TOKEN|PASSWORD|API_KEY)/u.test(name)) {
    fail(`${name}은 공개 Expo 번들에 넣을 수 없습니다.`);
  }
}

const eas = JSON.parse(fs.readFileSync(path.join(appRoot, "eas.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
if (eas.cli?.requireCommit !== true) fail("eas.json cli.requireCommit은 true여야 합니다.");
if (eas.cli?.appVersionSource !== "remote") {
  fail("eas.json appVersionSource는 remote여야 합니다.");
}
if (eas.build?.production?.autoIncrement !== true) {
  fail("production autoIncrement가 켜져 있어야 합니다.");
}
if (eas.build?.production?.channel !== "production") {
  fail("production 업데이트 채널이 고정되지 않았습니다.");
}
if (packageJson.scripts?.["eas-build-post-install"] !== "node tools/eas-build-preflight.mjs") {
  fail("EAS production 빌드가 release preflight에 연결되지 않았습니다.");
}

const configSource = fs.readFileSync(path.join(appRoot, "app.config.js"), "utf8");
for (const required of [
  'bundleIdentifier: "com.singsong.app"',
  'package: "com.singsong.app"',
  'runtimeVersion: { policy: "fingerprint" }',
  'scheme: "singsong"',
]) {
  if (!configSource.includes(required)) fail(`app.config.js 계약 누락: ${required}`);
}

if (failures.length > 0) {
  console.error("Native release preflight: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Native release preflight: PASS");
