import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const finalDir = path.join(root, "final");
const referenceDir = path.join(root, "html");
const finalIds = [39, 33, 17, 13, 10, 8, 4, 1];
const finalIdSet = new Set(finalIds);

const promptText = await readFile(path.join(root, "PROMPTS.md"), "utf8");
const concepts = [...promptText.matchAll(/^(\d+)\. \*\*(.+?)\*\* — (.+)$/gm)].map(
  ([, serial, name, description]) => ({ serial: Number(serial), name, description }),
);

if (concepts.length !== 50) {
  throw new Error(`Expected 50 concepts, found ${concepts.length}`);
}

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const filename = ({ serial, name }) =>
  `${String(serial).padStart(2, "0")}-${slug(name)}.png`;

const conceptById = new Map(concepts.map((concept) => [concept.serial, concept]));
const finalists = finalIds.map((serial) => {
  const concept = conceptById.get(serial);
  if (!concept) throw new Error(`Missing finalist concept ${serial}`);
  return concept;
});
const references = concepts.filter(({ serial }) => !finalIdSet.has(serial));

const assertExactAssets = async (directory, expectedConcepts, label) => {
  const actual = (await readdir(directory))
    .filter((file) => /^\d{2}-[a-z0-9-]+\.png$/.test(file))
    .sort();
  const expected = expectedConcepts.map(filename).sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} asset mismatch\nMissing: ${missing.join(", ") || "none"}\nUnexpected: ${unexpected.join(", ") || "none"}`,
    );
  }
};

await assertExactAssets(finalDir, finalists, "Final");
await assertExactAssets(referenceDir, references, "Reference");

const families = [
  { start: 1, end: 10, code: "A", title: "SESSION S", subtitle: "이름과 세션 스트립" },
  { start: 11, end: 20, code: "B", title: "TICKET", subtitle: "계획의 발권과 확정" },
  { start: 21, end: 30, code: "C", title: "QUEUE", subtitle: "선곡 순서와 레저" },
  { start: 31, end: 40, code: "D", title: "GATHER", subtitle: "2–4인의 합류와 공유" },
  { start: 41, end: 50, code: "E", title: "REGISTER", subtitle: "계산과 등록 지점" },
];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderCard = (concept, imagePrefix, finalRank) => {
  const number = String(concept.serial).padStart(2, "0");
  const source = `${imagePrefix}${filename(concept)}`;
  return `
    <article class="card">
      <div class="visual">
        <img src="${source}" alt="${escapeHtml(concept.name)} logo concept" />
        <span class="serial">${number}</span>
        ${finalRank ? `<span class="pick">FINAL ${String(finalRank).padStart(2, "0")}</span>` : ""}
      </div>
      <div class="copy">
        <h3>${escapeHtml(concept.name)}</h3>
        <p>${escapeHtml(concept.description)}</p>
        <div class="tests">
          <span class="mini"><img src="${source}" alt="" /></span>
          <span class="micro"><img src="${source}" alt="" /></span>
          <span class="meta">PNG · 1:1</span>
        </div>
      </div>
    </article>`;
};

const css = `
  :root { color-scheme: light; --cream:#FAF7F0; --paper:#fff; --ink:#15131A; --muted:#665F68; --rose:#FF3D6E; --ochre:#B76E00; --line:#D9D1C5; }
  * { box-sizing: border-box; }
  html { background: var(--cream); }
  body { margin: 0; background: var(--cream); color: var(--ink); font-family: Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif; }
  main { width: min(2040px, calc(100% - 56px)); margin: 0 auto; padding: 64px 0 80px; }
  header { display:grid; grid-template-columns:1fr auto; gap:36px; align-items:end; padding-bottom:30px; border-bottom:4px solid var(--ink); }
  .eyebrow,.serial,.pick,.meta,.palette span,.family-head>span { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.08em; text-transform:uppercase; }
  .eyebrow { margin:0 0 12px; color:var(--rose); font-size:13px; font-weight:900; }
  h1 { max-width:1200px; margin:0; font-size:clamp(52px,5vw,90px); line-height:.92; letter-spacing:-.06em; }
  .subtitle { max-width:940px; margin:20px 0 0; color:var(--muted); font-size:18px; line-height:1.65; }
  .header-actions { display:grid; gap:12px; justify-items:end; }
  .board-link { display:inline-flex; padding:12px 15px; border:2px solid var(--ink); background:var(--paper); color:var(--ink); font-size:13px; font-weight:900; text-decoration:none; }
  .board-link:hover { background:var(--rose); }
  .palette { display:grid; grid-template-columns:repeat(2,auto); gap:10px 18px; padding:18px; border:2px solid var(--ink); background:var(--paper); }
  .palette span { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:850; }
  .swatch { width:15px; height:15px; border:1px solid var(--ink); }
  .rubric { display:flex; flex-wrap:wrap; gap:8px; margin:24px 0 46px; }
  .rubric span { padding:8px 11px; border:1px solid var(--ink); background:var(--paper); font-size:12px; font-weight:850; }
  .family { margin-top:56px; }
  .family-head { display:grid; grid-template-columns:120px 1fr auto; gap:18px; align-items:baseline; margin-bottom:18px; padding-bottom:12px; border-bottom:2px solid var(--ink); }
  .family-head>span { color:var(--rose); font-size:12px; font-weight:900; }
  .family-head h2 { margin:0; font-size:30px; letter-spacing:-.035em; }
  .family-head p { margin:0; color:var(--muted); font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:16px; }
  .grid.final-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .card { min-width:0; overflow:hidden; border:2px solid var(--ink); background:var(--paper); }
  .visual { position:relative; display:grid; place-items:center; aspect-ratio:1.08; padding:16px; overflow:hidden; border-bottom:1px solid var(--line); background:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px),#F4EFE7; background-size:22px 22px; }
  .visual>img { display:block; width:min(100%,270px); aspect-ratio:1; object-fit:cover; border-radius:18%; }
  .serial { position:absolute; top:12px; left:12px; display:grid; min-width:38px; height:30px; padding:0 8px; place-items:center; border:2px solid var(--ink); background:var(--rose); font-size:11px; font-weight:950; }
  .pick { position:absolute; top:12px; right:12px; padding:8px 10px; border:2px solid var(--ink); background:var(--ink); color:var(--paper); font-size:10px; font-weight:900; }
  .copy { padding:16px; }
  h3 { margin:0; font-size:18px; line-height:1.12; letter-spacing:-.025em; }
  .copy>p { min-height:62px; margin:12px 0 15px; color:var(--muted); font-size:12px; line-height:1.5; }
  .tests { display:flex; align-items:center; gap:8px; padding-top:13px; border-top:1px dashed var(--line); }
  .mini,.micro { display:grid; place-items:center; overflow:hidden; background:var(--cream); }
  .mini,.mini img { width:32px; height:32px; }
  .micro,.micro img { width:24px; height:24px; }
  .mini img,.micro img { object-fit:cover; }
  .meta { margin-left:auto; font-size:9px; font-weight:800; }
  footer { display:flex; justify-content:space-between; gap:24px; margin-top:42px; padding-top:18px; border-top:3px solid var(--ink); color:var(--muted); font-size:12px; }
  footer strong { color:var(--ink); }
  @media (max-width:1200px) { .grid,.grid.final-grid { grid-template-columns:repeat(3,1fr); } header { grid-template-columns:1fr; } .header-actions { justify-items:start; } }
  @media (max-width:760px) { main { width:min(100% - 24px,640px); padding-top:32px; } .grid,.grid.final-grid { grid-template-columns:1fr 1fr; } .family-head { grid-template-columns:1fr; gap:6px; } .family-head p { display:none; } h1 { font-size:48px; } }
`;

const palette = `
  <div class="palette" aria-label="palette">
    <span><i class="swatch" style="background:#FAF7F0"></i>#FAF7F0</span>
    <span><i class="swatch" style="background:#15131A"></i>#15131A</span>
    <span><i class="swatch" style="background:#FF3D6E"></i>#FF3D6E</span>
    <span><i class="swatch" style="background:#B76E00"></i>#B76E00</span>
  </div>`;

const document = ({ title, eyebrow, heading, subtitle, linkHref, linkLabel, rubric, sections, footer }) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${css}</style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${heading}</h1>
          <p class="subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <div class="header-actions">${palette}<a class="board-link" href="${linkHref}">${escapeHtml(linkLabel)}</a></div>
      </header>
      <div class="rubric">${rubric.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      ${sections}
      <footer><span>${escapeHtml(footer.note)}</span><strong>${escapeHtml(footer.label)}</strong></footer>
    </main>
  </body>
</html>`;

const finalSections = `
  <section class="family">
    <div class="family-head"><span>FINAL / 08</span><h2>SELECTED DIRECTIONS</h2><p>요청 순서 유지</p></div>
    <div class="grid final-grid">${finalists.map((concept, index) => renderCard(concept, "final/", index + 1)).join("")}</div>
  </section>`;

const referenceSections = families
  .map((family) => {
    const familyConcepts = references.filter(
      ({ serial }) => serial >= family.start && serial <= family.end,
    );
    if (!familyConcepts.length) return "";
    return `
      <section class="family">
        <div class="family-head"><span>${family.code} / REF</span><h2>${family.title}</h2><p>${family.subtitle}</p></div>
        <div class="grid">${familyConcepts.map((concept) => renderCard(concept, "")).join("")}</div>
      </section>`;
  })
  .join("");

const finalHtml = document({
  title: "SingSong — Final 8 Logo Directions",
  eyebrow: "SINGSONG / FINAL SHORTLIST / 2026",
  heading: "최종 후보<br />8가지 비교 보드",
  subtitle: "Matched Tear, Bridge Pass, Folded Receipt, Double Gate, Seal Cut S, Corner Fold S, Twin Stub Negative S, Folded Session S를 최종 후보로 분리했다.",
  linkHref: "html/index.html",
  linkLabel: "참고용 42안 보기 →",
  rubric: ["8 FINALISTS", "USER SELECTION", "24PX CHECK", "MASKABLE 66%", "NEXT: SVG REDRAW"],
  sections: finalSections,
  footer: {
    note: "선택 순서는 요청 순서다. 최종 확정 전 단색·24px·상표 유사성 검토와 SVG master 재작도가 필요하다.",
    label: "SINGSONG / FINAL 8",
  },
});

const referenceHtml = document({
  title: "SingSong — 42 Reference Logo Directions",
  eyebrow: "SINGSONG / REFERENCE ARCHIVE / 2026",
  heading: "참고용 로고<br />42가지 아카이브",
  subtitle: "최종 후보 8안을 제외한 탐색 결과다. 삭제하지 않고 비교·회고용으로 보존하며, 신규 최종 후보에는 포함하지 않는다.",
  linkHref: "../index.html",
  linkLabel: "← 최종 8안으로 돌아가기",
  rubric: ["42 REFERENCES", "NOT FINAL", "ORIGINAL IDS", "24PX CHECK", "ARCHIVE ONLY"],
  sections: referenceSections,
  footer: {
    note: "이 보드는 참고용 아카이브다. 최종 후보는 상위 경로의 비교 보드를 기준으로 한다.",
    label: "SINGSONG / REFERENCE 42",
  },
});

await Promise.all([
  writeFile(path.join(root, "index.html"), finalHtml, "utf8"),
  writeFile(path.join(referenceDir, "index.html"), referenceHtml, "utf8"),
]);

console.log(`Wrote final board with ${finalists.length} concepts.`);
console.log(`Wrote reference board with ${references.length} concepts.`);
