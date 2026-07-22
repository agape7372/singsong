# Run State

| Field                      | Value                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Run ID                     | `683054d4ee774d5ea65dedb69d21145c`                                                  |
| Phase                      | `RENEWAL_COMPLETE_PREVIEW_RESTART_REQUIRED`                                         |
| Production gate            | `BLOCKED_EXTERNAL`                                                                  |
| Local capability           | `LOCAL_DEMO_READY`: verified fixture production release candidate                   |
| Initial HEAD               | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a`                                          |
| Initial branch             | `claude/favorite-song-app-research-vs3yqa`                                          |
| Initial source fingerprint | `f1ca9045e6d8b46247f07a09dd02260b2641a24799611a7019b20e1baac363bd`                  |
| Initial dirty state        | 16 tracked modified, 46 untracked, 3 ignored                                        |
| Runtime lock               | `ACTIVE_RUN.lock` 없음; 이전 audit nonce cleanup 완료                               |
| Temporary preview          | `https://bond-athletics-calculations-putting.trycloudflare.com`                     |
| Preview owner              | app PID 29532 (`127.0.0.1:3000`), Cloudflare Quick Tunnel PID 32848                 |
| Current architecture       | `ARCHITECTURE.md`                                                                   |
| Final verification         | `VERIFICATION_REPORT.md`; 최신 39/190·build·responsive browser 결과                 |
| Final material audit       | `FINAL_MATERIAL_AUDIT.md` — 리뉴얼 전 233-path 보존 snapshot                        |
| Clean reproduction         | `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-shell-20260722-1033/` |

The initial user work is preserved in-place and independently matches Codex capture
tree `50173b6288…` for all 62 Git-visible files. The final re-audit measured 62/62 exact,
with missing/mismatch 0; the three initial ignored files also retain their baseline
SHA-256 values. Shell auditing caused the repository's existing Remember hook to create
one ignored post-baseline runtime log; this is not product input and will not be committed
or deployed.

Node 24.18/Next 16.2.11의 최신 리뉴얼 트리는 current format/lint/type, 39-file/190-test,
fixture build와 responsive Chromium 3/3을 통과했다. 리뉴얼 전 검증은 Playwright 20 discovered 중
13 pass와 7 intentional project-gated skip, standalone mobile organizer 1/1, 3/3 PWA,
PWA artifact와 lab/scripted performance 결과를 보존한다. byte-exact 233-path clean snapshot도
frozen install, format/lint/type, 37/185 coverage, Next build, PWA artifact와 smoke를 통과했다.
Next 16.1.7에서 발견한 15건(High 8건)은
16.2.11과 PostCSS 8.5.20으로
수정됐으며 남은 known dependency vulnerability는 0이다.
Production rights·credentials·Supabase/Turnstile/domain·device/user/legal/operations는
`BLOCKED_EXTERNAL`이며 실제 release build/deploy를 수행하지 않았다.

## 스마트폰 임시 preview와 설치

현재 Quick Tunnel URL은 공개 HTTPS phone flow 확인을 위해 임시로 유지한다. 최초
localhost-bound app의 public-origin search 403은 public hostname을 `NEXT_PUBLIC_SITE_URL`로
둔 fixture rebuild/start로 해결됐다. app PID 29532에서 public Origin search 200, share create
201/read 200과 Pixel 7 browser profile의 home→search→1곡 담기→plan→pricing→ticket→share→
read-only share→import/replace→home 흐름과 same-origin service-worker controller가 PASS해
당시 상태는 `ACTIVE_PREVIEW/READY`였지만 리뉴얼 build 뒤 기존 server manifest와 새 `.next`가
달라져 현재 정적 asset 5개가 500을 반환한다. 최신 앱 재게시는 명시적 승인이 필요하며 현재
상태는 `PREVIEW_RESTART_REQUIRED`다. 이는 actual physical device install이나 production PASS가 아니다.

- Android Chrome: **더보기 → 홈 화면에 추가 → 설치**.
- iPhone Safari: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**.

설치는 현재 임시 origin을 저장할 뿐 영구 서비스나 데이터 이전을 보장하지 않는다. Quick
Tunnel 또는 PC process가 종료되면 열리지 않고, stable hostname으로 바꾸면 브라우저
storage origin도 달라져 기존 IndexedDB 플랜이 자동 이동하지 않는다. 최종 배포에는 stable
host/domain, 해당 origin으로 다시 실행한 production smoke/PWA/OG, 설치 재안내가 필요하다.

app PID 29532와 tunnel PID 32848은 그대로 살아 있지만 최신 asset 검증 전에는 preview URL을
사용 가능한 앱으로 안내하지 않는다. 종료하거나 재시작할 때는 root owner가 정확한
PID/command/listener를 다시 확인하고, 외부 재공개는 사용자의 명시적 승인을 받은 뒤 수행한다.
