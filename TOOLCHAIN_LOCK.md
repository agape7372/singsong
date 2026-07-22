# SingSong Toolchain Lock

관측일: 2026-07-22 Asia/Seoul  
최종 검증 환경: Windows PowerShell, Node.js `v24.18.0`, Git `2.52.0.windows.1`  
package manager 계약: pnpm `11.9.0` (`packageManager`와 engines exact)

## Runtime과 framework

| 영역                    |       Exact version | 소유 파일                        |
| ----------------------- | ------------------: | -------------------------------- |
| Node runtime            |     exact `24.18.0` | `.nvmrc`, `package.json`         |
| pnpm                    |            `11.9.0` | `package.json`, `pnpm-lock.yaml` |
| Next.js                 |           `16.2.11` | package + lockfile               |
| React / React DOM       | `19.2.7` / `19.2.7` | lockfile                         |
| TypeScript              |             `5.9.3` | lockfile                         |
| Tailwind CSS / adapter  |   `4.3.3` / `4.3.3` | lockfile                         |
| Next transitive PostCSS |            `8.5.20` | workspace override               |
| Serwist Next / core     | `9.5.11` / `9.5.11` | lockfile                         |
| Dexie                   |             `4.4.4` | lockfile                         |
| Zod                     |             `4.4.3` | lockfile                         |
| Base UI                 |             `1.6.0` | lockfile                         |
| motion                  |           `12.42.2` | lockfile; import `motion/react`  |
| Supabase JS             |           `2.110.7` | server repository only           |
| html-to-image           |           `1.11.13` | local PNG adapter                |
| sharp                   |            `0.34.5` | icon generation/build tool       |

## Quality toolchain

| Tool                  |        Exact version | 역할                             |
| --------------------- | -------------------: | -------------------------------- |
| ESLint / Next config  | `9.39.1` / `16.2.11` | lint, zero warning               |
| Prettier              |              `3.9.5` | deterministic format             |
| Vitest / coverage-v8  |  `4.1.10` / `4.1.10` | unit/integration/static/coverage |
| fast-check            |              `4.9.0` | calculation oracle/property      |
| fake-indexeddb        |              `6.2.5` | Dexie transaction tests          |
| Playwright            |             `1.61.1` | mobile/desktop E2E               |
| axe Playwright        |             `4.12.1` | critical/serious accessibility   |
| Testing Library React |             `16.3.2` | component test support           |
| jsdom                 |             `29.1.1` | DOM test support                 |

Playwright Chromium은 설치 후 managed sandbox에서 첫 spawn이 `EPERM`으로 차단됐고, 승인된 동일 명령 재실행에서 E2E와 PWA가 PASS했다. WebKit, real Safari, Android Chrome, Kakao WebView와 설치 PWA 실기기는 별도 evidence다.

## Integrity

관측 시 SHA-256:

| File                                                       | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `package.json`                                             | `73F5D9EF322D99B1F93230A6DF6B11A0BC8AB4FED73C3B097630D653D85A530C` |
| `pnpm-lock.yaml`                                           | `BD35EDBE38214C6931CBF2354B318F3A64F7E4B72C34C9ED9D386FE2B6F9542B` |
| `pnpm-workspace.yaml`                                      | `1809A4A1BF71D775AB78D5EE0FF75A7E838144FB5B307DA293A4D65293A33160` |
| `.npmrc`                                                   | `CEDFC1700CB9248A0D86B8345222D7871A378DE7521612300A7FE7E3A65EE9E9` |
| `.nvmrc`                                                   | `55075B5EC4E8B31936CBBC282B8829116D1FD48F2F2F1856DEE592A6650700CE` |
| `supabase/migrations/20260722010000_share_snapshot_v1.sql` | `B08B68A8574858AE0A6A256CB31A4105B73583A14005367008F6CA6FA40EB811` |

다른 에이전트가 dependency/migration을 정당하게 수정하면 hash를 다시 측정하고 이 표와 변경 이유를 함께 갱신해야 한다. version을 floating `latest`로 바꾸지 않는다.

## Reproducible lifecycle

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract
pnpm build:demo
pnpm test:e2e
pnpm test:pwa
pnpm perf:lab
pnpm start
```

`pnpm verify:demo`는 `install:frozen`, 위 quality 단계, demo build, built-PWA artifact 검사, fixture HTTP smoke, core E2E와 built-PWA browser 검증을 순서대로 묶는다.

Production은 모든 server secret을 배포 secret manager에 설정한 환경에서만 다음을 실행한다.

```powershell
pnpm install --frozen-lockfile
pnpm verify:release
pnpm start
```

`verify:release`는 release preflight/build/artifact scan 뒤 production-profile HTTP smoke와 `test:pwa:release`까지 실행한다. 필수 외부 secret·권리 manifest가 없는 환경에서는 deterministic `BLOCK_EXTERNAL`이 정상 결과다.

`pnpm-workspace.yaml`의 dependency build allowlist는 `sharp`와 `unrs-resolver`뿐이다. Next의 취약한 transitive PostCSS를 `8.5.20`으로 정확히 override한다. 공급망 `minimumReleaseAge` 정책에서 방금 공개된 Next 16.2.11, 해당 SWC 플랫폼 패키지, env와 ESLint config만 exact 12-entry allowlist로 예외 처리하며 범위나 floating tag를 허용하지 않는다. Serwist의 Next peer 범위는 `>=14`라 16.2.11과 호환된다. build는 Next/Serwist의 현재 검증 경로인 Webpack을 명시한다. 외부 profile 계약은 `fixture`/`release`이고 release는 내부 production runtime으로 매핑된다. `APP_PROFILE`이 없거나 release 필수 env·권리 manifest가 없으면 fail하는 것이 정상이다.

## Dependency security closure

최초 `pnpm audit --prod --audit-level=high`는 Next 16.1.7 dependency graph에서 15건(High 8건)을 발견했다. npm의 stable patch인 Next와 `eslint-config-next` 16.2.11로 올리고 transitive PostCSS를 8.5.20으로 고정했다. 최종 prod+dev 전체 `pnpm audit --audit-level=low`는 exit 0과 `No known vulnerabilities found`를 반환했다. 이는 해결된 출시 blocker이며 남은 known dependency vulnerability는 없다.

## 최종 재현 결과

| 검증                    | 결과                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current frozen install  | `PASS`, rebuild 10.2s, 506 packages, lockfile 변경 0                                                                                                            |
| Clean frozen install    | current 233-path copy `PASS`, 506 packages reused, downloaded 0, lockfile 변경 0                                                                                |
| Dependency audit/policy | prod+dev level low exit 0, known vulnerability 0; 613 lock entries와 exact policy `PASS`                                                                        |
| Format/lint/type        | current와 233-path clean 모두 exit 0, lint warning 0                                                                                                            |
| Full Vitest             | 37 files, 185 tests `PASS`                                                                                                                                      |
| Coverage                | statements 82.27% (1560/1896), branches 75.47% (1074/1423), functions 86.06% (315/366), lines 84.91% (1464/1724); all thresholds `PASS`                         |
| Contract alias          | 4 files, 21 tests `PASS`, 340ms                                                                                                                                 |
| Demo build              | Next 16.2.11 current `PASS`; current 233-path clean `PASS`, compile 5.9s/type 2.8s                                                                              |
| HTTP/start              | current·clean home/ticket/OG 200, OG 30,423 bytes; home JS gzip current 167,035/clean 167,056 bytes                                                             |
| Browser                 | E2E 20 discovered, 13 pass + 7 intentional project-gated skip; mobile organizer 1/1; PWA 3/3; public SW controller `PASS`                                       |
| PWA artifact            | precache 45, forbidden route 0                                                                                                                                  |
| Performance             | cold LCP 324/336ms·TBT 234/240ms·CLS 0.0005; warm LCP 92/144ms·TBT 0; search p95 15.7ms; calculation 14/23.7ms; ticket 505ms `PASS`; field p75 `NOT_RUN + NONE` |

정확한 smoke byte 수, performance distribution과 외부 gate는 `VERIFICATION_REPORT.md`가 소유한다.

## 환경 차이와 unavailable tool

- `.nvmrc`와 package engine의 exact Node `24.18.0`, pnpm `11.9.0`에서 current와 byte-exact 233-path clean의 install/static/test/coverage/build/PWA/smoke를 재현했다.
- audit/install은 sandbox에서 package/cache `EACCES`가 먼저 발생했고 승인된 동일 audit/install이 vulnerability 0과 506-package frozen install로 PASS했다. clean은 reused 506/downloaded 0이다. 이 환경 재시도는 의존성 오류나 lockfile 변경이 아니다.
- Next 16.1.7의 stale `.next` type output은 `clean:generated`로만 제거하고 16.2.11에서 재생성했다. shell 이전 cold coverage의 OG timeout은 assertion을 유지한 integration ceiling으로 해결했다. 최종 shell coverage는 BottomSlot의 실제 fixed/flow/cleanup branch 5개를 추가해 제품/threshold 변경 없이 full 37 files/185 tests와 global branch 75.47%를 PASS했다.
- Chromium은 sandbox spawn `EPERM` 뒤 승인된 동일 Playwright 실행에서 PASS했다. 첫 차단과 재실행 결과를 모두 보존하며 승인된 결과만 browser PASS 근거로 쓴다.
- Docker daemon과 local Supabase/PostgREST 실행 권한, Supabase CLI, production credentials는 현재 증거가 없다. SQL static review를 실제 ACL/RPC PASS로 승격하지 않는다.
- 운영 브라우저/DB/도메인과 외부 network의 exact 버전은 배포 환경이 정해질 때 이 문서의 별도 environment subject로 추가한다.
