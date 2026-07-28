# Run State

| Field                      | Value                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Run ID                     | `683054d4ee774d5ea65dedb69d21145c`                                                  |
| Phase                      | `NATIVE_REPOSITORY_COMPLETION`                                                       |
| Production gate            | `BLOCKED_EXTERNAL`                                                                  |
| Local capability           | `NATIVE_REPOSITORY_READY`: Expo app + share API fixture candidate                    |
| Current branch             | `rebuild/expo-monorepo`                                                             |
| Native completion base     | `1abfaca`                                                                           |
| Current runtime            | Node `v24.11.1`, npm `11.6.2`                                                       |
| Native app                 | `apps/app`: Android/iOS source, local lint/type/export gates                         |
| Share service              | `services/share-api`: fixture smoke ready; production preflight blocked externally   |
| Native parity              | `docs/PARITY_LEDGER.md`; repository rows closed, device/infra rows external          |
| Initial HEAD               | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a`                                          |
| Initial branch             | `claude/favorite-song-app-research-vs3yqa`                                          |
| Initial source fingerprint | `f1ca9045e6d8b46247f07a09dd02260b2641a24799611a7019b20e1baac363bd`                  |
| Initial dirty state        | 16 tracked modified, 46 untracked, 3 ignored                                        |
| Runtime lock               | `ACTIVE_RUN.lock` 없음; 이전 audit nonce cleanup 완료                               |
| Historical PWA preview     | 2026-07-23 Quick Tunnel 기록; 2026-07-28 생존 여부 미검증                           |
| Historical preview owner   | 당시 app PID 43664 / tunnel PID 43376; 현재 프로세스 권위 아님                     |
| Current architecture       | `NATIVE_APP_COMPLETION_PLAN.md` + canonical native rebuild plan                     |
| Final verification         | `VERIFICATION_REPORT.md`; native completion section is authoritative                 |
| Final material audit       | `FINAL_MATERIAL_AUDIT.md` — 리뉴얼 전 233-path 보존 snapshot                        |
| Clean reproduction         | `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-shell-20260722-1033/` |

2026-07-28부터 위 행이 현재 제품 상태를 소유한다. 아래의 Next/PWA 수치와 Quick Tunnel
프로세스는 보존된 기준선의 과거 실행 기록이며, 네이티브 APK 또는 새 공유 서비스가
배포됐다는 뜻이 아니다.

The initial user work is preserved in-place and independently matches Codex capture
tree `50173b6288…` for all 62 Git-visible files. The final re-audit measured 62/62 exact,
with missing/mismatch 0; the three initial ignored files also retain their baseline
SHA-256 values. Shell auditing caused the repository's existing Remember hook to create
one ignored post-baseline runtime log; this is not product input and will not be committed
or deployed.

네이티브 완료 트리는 root format/lint/type, monorepo 17/17, M1 12개 gate,
64-file/504-test coverage(83.53/76.02/84.11/85.69), 앱 lint/type/15 tests,
Expo doctor 20/20/install check/Android Hermes export, 공유 API 144 tests/smoke,
브라우저 랜딩 3/3과 보존된 Next build를 통과했다.

앱과 root runtime 감사는 취약점 0건이다. 전체 앱·root 감사에는 ESLint/minimatch 3 개발
체인의 `brace-expansion` high 9건이 남는다. 호환되지 않는 v5 강제 override는 제거했고
upstream 도구 교체 항목으로 추적한다. Production rights·credentials·Supabase/Redis/domain·
device/user/legal/operations는 `BLOCKED_EXTERNAL`이며 실제 서비스/EAS release deploy를
수행하지 않았다.

## 스마트폰 임시 preview와 설치

아래 Quick Tunnel 내용은 2026-07-23 공개 HTTPS phone flow의 보존 기록이다.
2026-07-28 네이티브 완료 run은 해당 프로세스나 URL의 생존을 검증하지 않았다. 당시
사용자 승인에 따라 `main`의 Station public-origin fixture build를 최초 app PID 35632로 재게시했고,
Folded Session S 적용 뒤 app PID 43664로 재빌드·재시작했다. 헤더·manifest·Apple metadata는
`folded-session-s-{180,192,512}.png`를 사용하고 service worker runtime cache는
`singsong-static-v2`다. 공개 icon·manifest·service worker는 모두 200, 최신 Chromium PWA는
3/3 PASS이며 기존 전체 회귀는 13 pass/7 intentional skip이다. skip-link hotfix 직후 첫 service-worker 전환에서
한 번 흔들렸으나 갱신 뒤 재시도 없는 3회 연속 및 전체 suite가 통과했다. 당시 상태는
`ACTIVE_PREVIEW/READY`였으며 actual physical device install이나 production PASS가 아니었다.

기존 터널은 싱송 프로세스 종료 뒤 공용 3000번 포트를 점유한 Podoal을 그대로 전달했다.
브라우저 cache 문제가 아니라 origin target 오노출이었으며, 해당 tunnel PID 32848을 종료하고
Podoal PID 26756은 건드리지 않은 채 싱송을 전용 34173번 포트와 새 터널로 분리했다.

- Android Chrome: 기존 설치 창을 취소하고 탭을 완전히 닫은 뒤 `/?v=folded-session-s` 재접속 → **더보기 → 홈 화면에 추가 → 설치**.
- iPhone Safari: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**.

사이트 데이터 삭제는 Dexie의 origin-local 플랜을 지울 수 있으므로 아이콘 갱신 절차로 사용하지 않는다.

설치는 현재 임시 origin을 저장할 뿐 영구 서비스나 데이터 이전을 보장하지 않는다. Quick
Tunnel 또는 PC process가 종료되면 열리지 않고, stable hostname으로 바꾸면 브라우저
storage origin도 달라져 기존 IndexedDB 플랜이 자동 이동하지 않는다. 최종 배포에는 stable
host/domain, 해당 origin으로 다시 실행한 production smoke/PWA/OG, 설치 재안내가 필요하다.

당시 app PID 43664와 tunnel PID 43376이 preview를 소유했다. 현재 종료/재시작 대상으로
간주하지 말고 root owner가 PID/command/listener를 다시 확인하며, 외부 재공개는 사용자의
명시적 승인을 받은 뒤 수행한다.
