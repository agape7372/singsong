import { formatKstDate, formatMinuteRange, formatWonRange } from "@singsong/domain/format";
import { buildTicketScene, renderTicketSceneSvg, type TicketModel } from "@singsong/ticket-art";

import type { ShareRecord } from "./share/types.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shell(head: string, body: string) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="no-referrer">
  ${head}
  <style>
    :root { color-scheme: light; --paper:#f6efdc; --ink:#241c2d; --muted:#6d6373; --accent:#bd1647; --canvas:#faf7f0; }
    * { box-sizing: border-box; }
    html { background:var(--canvas); color:var(--ink); font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; }
    body { margin:0; min-height:100vh; }
    main { width:min(100% - 32px, 760px); margin:0 auto; padding:40px 0 64px; }
    .eyebrow { margin:0 0 8px; color:var(--accent); font-size:.78rem; font-weight:800; letter-spacing:.12em; }
    h1 { margin:0; font-size:clamp(1.75rem,7vw,3.1rem); line-height:1.08; letter-spacing:-.035em; }
    .lede { color:var(--muted); line-height:1.65; }
    .ticket { margin:28px 0; overflow:hidden; border:1px solid #d7c9aa; border-radius:24px; background:var(--paper); box-shadow:0 18px 48px rgba(36,28,45,.12); }
    .ticket svg { display:block; width:100%; height:auto; }
    .ledger { padding:4px 24px 24px; }
    .ledger h2 { margin:0 0 12px; font-size:1rem; }
    ol { margin:0; padding:0; list-style:none; counter-reset:song; }
    li { counter-increment:song; display:grid; grid-template-columns:2rem minmax(0,1fr); gap:8px; padding:12px 0; border-top:1px solid #dfd2b6; }
    li::before { content:counter(song, decimal-leading-zero); color:var(--accent); font-weight:800; }
    li span { min-width:0; overflow-wrap:anywhere; }
    li small { display:block; margin-top:3px; color:var(--muted); }
    .actions { display:grid; gap:10px; }
    .button { display:block; min-height:48px; padding:13px 18px; border-radius:12px; background:var(--ink); color:white; text-align:center; text-decoration:none; font-weight:800; }
    .note { color:var(--muted); font-size:.88rem; line-height:1.6; }
    .unavailable { padding:64px 0; }
    @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; } }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function renderShareLanding(share: ShareRecord, siteOrigin: URL) {
  const count = share.payload.calculation.songCount;
  const title = `${count}곡 세션 티켓`;
  const duration = formatMinuteRange(
    share.payload.calculation.duration.lowSec,
    share.payload.calculation.duration.highSec,
  );
  const perPerson = formatWonRange(
    share.payload.calculation.derived.perPersonLowWon,
    share.payload.calculation.derived.perPersonHighWon,
  );
  const total = formatWonRange(
    share.payload.calculation.derived.totalLowWon,
    share.payload.calculation.derived.totalHighWon,
  );
  const description = `약 ${duration} · 1인당 ${perPerson}. 함께 부를 순서를 확인하세요.`;
  const shareUrl = new URL(`/s/${encodeURIComponent(share.slug)}`, siteOrigin).href;
  const imageUrl = new URL("/og/ticket-1200x630.png", siteOrigin).href;
  const deepLink = `singsong://s/${encodeURIComponent(share.slug)}`;
  const ticketModel: TicketModel = {
    songCount: count,
    totalLabel: total,
    durationLabel: `약 ${duration}`,
    perPersonLabel: `1인 ${perPerson}`,
    serial: share.fingerprint.slice(0, 10).toUpperCase(),
  };
  const ticketSvg = renderTicketSceneSvg(
    buildTicketScene(ticketModel, {
      width: 540,
      height: 675,
      variant: "og",
    }),
    {
      idPrefix: "ticket",
      title,
      description: `약 ${duration}, 1인당 ${perPerson}`,
    },
  );
  const items = share.payload.items
    .map(
      (item) =>
        `<li><span>${escapeHtml(item.title)}<small>${escapeHtml(item.artist)}</small></span></li>`,
    )
    .join("");
  const head = `<title>${escapeHtml(title)} · 싱송</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(shareUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="싱송">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`;
  const body = `<main>
  <header>
    <p class="eyebrow">받은 티켓 · READ ONLY</p>
    <h1>함께 부를 세션이 도착했어요.</h1>
    <p class="lede">만료 ${escapeHtml(formatKstDate(share.expiresAt))}</p>
  </header>
  <article class="ticket" aria-labelledby="ticket-title">
    ${ticketSvg}
    <section class="ledger" aria-labelledby="ledger-heading">
      <h2 id="ledger-heading">부를 순서</h2>
      <ol>${items}</ol>
    </section>
  </article>
  <section class="actions" aria-labelledby="handoff-heading">
    <h2 id="handoff-heading">앱에서 이어서 볼까요?</h2>
    <a class="button" href="${escapeHtml(deepLink)}">싱송 앱으로 열기</a>
    <p class="note">이 페이지는 읽기 전용입니다. 주소를 아는 사람은 만료 전까지 볼 수 있으며, 검색 결과에는 등록되지 않습니다.</p>
  </section>
</main>`;
  return shell(head, body);
}

export function renderUnavailableLanding() {
  const head = `<title>공유 티켓을 열 수 없음 · 싱송</title>
  <meta name="description" content="공유 티켓이 만료되었거나 폐기되었습니다.">`;
  const body = `<main class="unavailable">
  <p class="eyebrow">SINGSONG · UNAVAILABLE</p>
  <h1>이 공유 티켓을 열 수 없어요.</h1>
  <p class="lede">주소가 잘못되었거나, 티켓이 만료 또는 폐기되었습니다.</p>
</main>`;
  return shell(head, body);
}

export { escapeHtml };
