# Vercel 영구 배포 가이드 (핸드폰에서 확인하기)

이 문서는 SingSong(fixture 데모 프로필)을 **사라지지 않는 공개 HTTPS URL**로 배포해
핸드폰 브라우저에서 바로 열고, 홈 화면에 PWA로 설치하는 방법을 설명한다.

Next.js를 네이티브로 실행하는 Vercel을 쓴다. App Router 서버 컴포넌트, BFF API 라우트
(`/api/*`), 동적 공유 라우트(`/s/[slug]`), serwist 서비스워커가 그대로 동작하므로 정적
호스팅(GitHub Pages)보다 이 앱에 맞다.

## 무엇이 배포되나

- **프로필**: `fixture`(데모). 합성 `TEST DATA`만 사용하며 UI에 `TEST DATA` 표식이 보인다.
- **비밀키 불필요**: fixture는 Supabase/Turnstile 등 운영 자격증명 없이 빌드·구동된다.
  실제 곡 카탈로그·운영 공유 저장소를 쓰는 `release` 공개 출시는 여전히
  `BLOCKED_EXTERNAL`이다([README](../README.md) 참고).
- **완전 동작**: 세션 플래너 UI는 local-first(브라우저 IndexedDB)라 완전히 동작하고,
  PNG 티켓 내보내기, 홈 화면 설치(PWA)도 된다.
- **제한**: fixture 공유 링크(`/s/*`) 저장소는 프로세스 로컬(메모리)이라 서버리스
  환경에서는 best-effort다. 데모에서 발급한 링크가 다른 서버 인스턴스에서 항상
  열리지는 않을 수 있다. 확인·시연 목적에는 영향이 없다.

## 사전 준비된 것

저장소 루트의 [`vercel.json`](../vercel.json)이 배포 설정을 코드로 고정한다:

- `framework: nextjs`
- `installCommand`: `npm_config_engine_strict=false pnpm install --frozen-lockfile`
  — 이 저장소는 Node를 `24.18.0`으로 정확히 고정하고 `engine-strict`가 켜져 있어,
  Vercel이 제공하는 Node 24 패치 버전이 다르면 설치가 실패한다. **배포 설치 단계에서만**
  engine-strict를 꺼서 이 문제를 피한다. 로컬 개발 계약(`.npmrc`)은 그대로 둔다.
- `buildCommand`: `pnpm build:demo` — fixture 프로필을 강제한다.

따라서 Vercel 대시보드에서 Install/Build 명령을 직접 입력할 필요가 없다.

## 배포 절차 (일회성, 약 2분, 무료)

1. <https://vercel.com> 에 GitHub 계정으로 무료 가입/로그인한다.
2. **Add New… → Project**를 누르고, GitHub 연동에서 `agape7372/singsong` 저장소를 **Import**한다.
   - 처음이라면 Vercel의 GitHub App에 이 저장소 접근 권한을 허용한다.
3. **Configure Project** 화면:
   - **Framework Preset**: `Next.js`(자동 감지).
   - **Root Directory**: 기본값(저장소 루트).
   - **Build & Install Command**: 건드리지 않는다. `vercel.json`이 채운다.
     (만약 대시보드가 Override 상태로 보이면, Override를 끄고 `vercel.json` 값을 쓰게 둔다.)
   - **Environment Variables**: 없어도 된다(fixture). 선택 사항은 아래 참고.
   - 배포 브랜치는 기본적으로 저장소 default 브랜치다. 이 데모 브랜치
     (`claude/mobile-accessibility-aiwxq8`)를 쓰려면, 프로젝트 생성 후
     **Settings → Git → Production Branch**를 해당 브랜치로 바꾸거나, 브랜치를 default에
     병합한다.
4. **Deploy**를 누른다. 빌드가 끝나면 `https://singsong-<hash>.vercel.app` 형태의
   **영구 URL**이 발급된다.
5. 그 URL을 **핸드폰 브라우저**에서 연다. 이후 저장소에 push할 때마다 자동 재배포된다.

## (선택) 공유/OG 메타를 정확히 하려면

앱 동작에는 불필요하지만, 공유 카드(OpenGraph)와 절대 URL 메타를 정확히 하려면 최초 배포
후 발급된 URL을 환경변수에 넣고 재배포한다:

- **Settings → Environment Variables**에 추가:
  - `NEXT_PUBLIC_SITE_URL = https://<발급된-도메인>`
- 저장 후 **Deployments → 최신 배포 → Redeploy**.

`NEXT_PUBLIC_APP_PROFILE`/`APP_PROFILE`은 `build:demo`가 `fixture`로 강제하므로 별도로
설정하지 않는다. 어떤 비밀도 `NEXT_PUBLIC_` 접두사로 넣지 않는다.

## 핸드폰에 앱으로 설치 (홈 화면 추가)

발급된 HTTPS URL을 연 뒤:

- **Android Chrome**: 우측 상단 **⋮ 더보기 → 홈 화면에 추가 → 설치**.
- **iPhone Safari**: 하단 **공유 → 홈 화면에 추가 → 추가**. (Safari에서 열어야 설치가 뜬다.)

설치하면 standalone 앱처럼 전체화면으로 실행된다.

## 확인 체크리스트

- [ ] Vercel 배포가 성공(초록색)하고 URL이 열린다.
- [ ] 핸드폰/데스크톱 브라우저에서 플래너 화면이 렌더된다.
- [ ] Chrome DevTools → Application 탭에서 manifest와 service worker가 인식된다.
- [ ] 홈 화면 추가 후 standalone으로 실행된다.

## 문제 해결

- **설치(install) 실패 / engine 오류**: `vercel.json`의 `installCommand`가 적용됐는지
  확인한다(대시보드 Override가 켜져 있으면 끈다).
- **빌드가 APP_PROFILE 오류로 실패**: `vercel.json`의 `buildCommand`가 `pnpm build:demo`
  인지 확인한다. `next.config.mjs`는 `APP_PROFILE`이 없으면 의도적으로 실패한다.
- **Node 버전**: Vercel 프로젝트 **Settings → Node.js Version**을 24.x로 둔다(기본 최신).
