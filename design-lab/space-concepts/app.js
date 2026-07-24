const concepts = [
  {
    id: "room",
    number: "01",
    family: "cutline",
    familyLabel: "CUTLINE 2.0 · WARM SPACE",
    title: "모임의 방",
    thesis: "사람과 노래가 하나의 테이블로 모이는 가장 따뜻한 안",
    label: "ROOM 01 · OPEN",
    headline: "우리 방에 노래를 놓아봐.",
    copy: "의자부터 채우고, 가운데 테이블 위에 오늘 부를 곡을 하나씩 올려요.",
    sceneLabels: ["창가", "우리 테이블", "빈 의자"],
  },
  {
    id: "lobby",
    number: "02",
    family: "cutline",
    familyLabel: "CUTLINE 2.0 · ARRIVAL SPACE",
    title: "약속 로비",
    thesis: "아직 시작 전인 설렘을 도착 안내와 다음 행동으로 표현",
    label: "LOBBY · 3 FRIENDS ARRIVED",
    headline: "다 모이면, 오늘의 방이 열려.",
    copy: "약속 시간과 도착 상태를 먼저 확인하고 기다리는 동안 곡을 골라요.",
    sceneLabels: ["19:30", "3명 도착", "ROOM 준비 중"],
  },
  {
    id: "atelier",
    number: "03",
    family: "cutline",
    familyLabel: "CUTLINE 2.0 · MAKING SPACE",
    title: "선곡 아틀리에",
    thesis: "곡을 재료처럼 펼치고 순서와 예산을 함께 다듬는 작업실",
    label: "ATELIER · WORK IN PROGRESS",
    headline: "좋은 밤은 같이 다듬는 거니까.",
    copy: "찾은 곡, 고민 중인 곡, 꼭 부를 곡을 작업대 위에서 정리해요.",
    sceneLabels: ["재료 선반", "작업대", "완성 전"],
  },
  {
    id: "poster",
    number: "04",
    family: "editorial",
    familyLabel: "BOLD EDITORIAL · TYPE SPACE",
    title: "포스터 홀",
    thesis: "약속의 에너지를 큰 활자와 포스터가 이어지는 복도로 표현",
    label: "TONIGHT / HALL 04",
    headline: "토요일 밤의 제목은 우리가 정해.",
    copy: "곡 하나가 포스터 하나가 되고, 선택할수록 오늘 밤의 벽이 채워져요.",
    sceneLabels: ["SAT", "PLAYLIST", "OUR NIGHT"],
  },
  {
    id: "gallery",
    number: "05",
    family: "editorial",
    familyLabel: "BOLD EDITORIAL · DARK SPACE",
    title: "나이트 갤러리",
    thesis: "어두운 전시 공간에서 선택한 곡만 작품처럼 또렷하게 부각",
    label: "GALLERY OPEN UNTIL LATE",
    headline: "오늘 전시할 목소리를 골라봐.",
    copy: "과한 네온 대신 깊은 잉크색 벽과 절제된 색 면으로 집중을 만들어요.",
    sceneLabels: ["ROOM A", "NOW CURATING", "4 VOICES"],
  },
  {
    id: "court",
    number: "06",
    family: "editorial",
    familyLabel: "BOLD EDITORIAL · SOCIAL SPACE",
    title: "라운드 코트",
    thesis: "누가 주인공인지 정하지 않고 원형 중정에 모두를 같은 비중으로 배치",
    label: "ROUND 06 · EVERY VOICE COUNTS",
    headline: "가운데는 비워두고, 우리를 둘러앉혀.",
    copy: "사람이 먼저 보이고 각자의 한 곡이 중앙으로 모이는 참여형 공간이에요.",
    sceneLabels: ["나", "민", "수", "＋"],
  },
  {
    id: "desk",
    number: "07",
    family: "utility",
    familyLabel: "UTILITY LEDGER · CONTROL SPACE",
    title: "컨트롤 데스크",
    thesis: "현장에서 가장 빠르게 곡·인원·시간·비용을 조정하는 운영형 안",
    label: "CONTROL DESK · LIVE PLAN",
    headline: "지금 필요한 정보만 한 번에.",
    copy: "장식보다 상태와 조작을 우선해 입장 직전에도 빠르게 계획을 끝내요.",
    sceneLabels: ["QUEUE 03", "PEOPLE 04", "READY 72%"],
  },
  {
    id: "map",
    number: "08",
    family: "utility",
    familyLabel: "UTILITY LEDGER · FLOOR SPACE",
    title: "룸 맵",
    thesis: "검색·곡 목록·예상을 하나의 평면도 안에서 이동하는 구역으로 설계",
    label: "ROOM MAP · YOU ARE HERE",
    headline: "약속의 빈칸을 방처럼 채워가.",
    copy: "각 작업이 어디에 있고 무엇이 남았는지 공간 배치만으로 이해해요.",
    sceneLabels: ["찾기", "고르기", "맞추기", "확정"],
  },
  {
    id: "commons",
    number: "09",
    family: "utility",
    familyLabel: "UTILITY LEDGER · TIME SPACE",
    title: "스케줄 커먼즈",
    thesis: "공용 일정 보드처럼 약속 전후 시간과 준비 상태를 함께 확인",
    label: "COMMONS · SATURDAY",
    headline: "언제 만나서 얼마나 놀지, 한 줄로.",
    copy: "시간 축 위에 만남, 노래, 귀가 범위를 놓아 현실적인 약속을 만들어요.",
    sceneLabels: ["19:30 만남", "20:00 입장", "21:30 이동"],
  },
  {
    id: "station",
    number: "10",
    family: "hybrid",
    familyLabel: "HYBRID · SIGNATURE SPACE",
    title: "싱송 스테이션",
    thesis: "따뜻함·브랜드성·실용성을 하나의 약속 출발 거점으로 통합",
    label: "SINGSONG STATION · DEPART TOGETHER",
    headline: "우리 밤이 출발할 준비를 해.",
    copy: "사람이 모이고 곡을 싣고 예상을 확인한 뒤, 마지막에 약속을 출발시켜요.",
    sceneLabels: ["모이기", "곡 싣기", "예상 확인", "출발"],
  },
];

const initialSongs = [
  { title: "우리가 웃었던 밤", artist: "테스트 카탈로그" },
  { title: "느린 토요일", artist: "테스트 카탈로그" },
  { title: "다시 만난 여기", artist: "테스트 카탈로그" },
];

const extraSongs = [
  { title: "창가의 약속", artist: "테스트 카탈로그" },
  { title: "마지막 한 곡", artist: "테스트 카탈로그" },
];

const grid = document.querySelector("#concept-grid");
const template = document.querySelector("#concept-template");
const ticketDialog = document.querySelector("#ticket-dialog");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let dialogOpener = null;

function formatWon(value) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function getMetrics(card) {
  const songs = card.querySelectorAll(".song-row").length;
  const people = Number(card.dataset.people ?? 4);
  return {
    songs,
    people,
    minMinutes: songs * 6,
    maxMinutes: songs * 8,
    minCost: songs * 6000 + people * 1500,
    maxCost: songs * 8000 + people * 2000,
  };
}

function updateMetrics(card) {
  const metrics = getMetrics(card);
  card.querySelector(".song-count").textContent = `${metrics.songs}곡`;
  card.querySelector(".people-count").textContent = `${metrics.people}명`;
  card.querySelector(".time-value").textContent = `${metrics.minMinutes}–${metrics.maxMinutes}분`;
  card.querySelector(".cost-value").textContent =
    `${formatWon(metrics.minCost)}–${formatWon(metrics.maxCost)}`;

  const addButton = card.querySelector(".add-song");
  const atLimit = metrics.songs >= initialSongs.length + extraSongs.length;
  addButton.disabled = atLimit;
  addButton.innerHTML = atLimit ? "오늘의 곡이 충분해요" : "<span>＋</span> 곡 하나 더 놓기";
}

function createSongRow(song, index) {
  const item = document.createElement("li");
  item.className = "song-row";

  const number = document.createElement("span");
  number.className = "song-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const copy = document.createElement("span");
  copy.className = "song-copy";
  const title = document.createElement("strong");
  title.textContent = song.title;
  const artist = document.createElement("small");
  artist.textContent = song.artist;
  copy.append(title, artist);

  const remove = document.createElement("button");
  remove.className = "remove-song";
  remove.type = "button";
  remove.setAttribute("aria-label", `${song.title} 빼기`);
  remove.textContent = "×";

  item.append(number, copy, remove);
  return item;
}

function renumberSongs(card) {
  card.querySelectorAll(".song-row").forEach((row, index) => {
    row.querySelector(".song-number").textContent = String(index + 1).padStart(2, "0");
  });
}

function buildScene(scene, concept) {
  scene.replaceChildren();
  concept.sceneLabels.forEach((label, index) => {
    const zone = document.createElement("span");
    zone.className = `scene-zone scene-zone-${index + 1}`;
    zone.textContent = label;
    scene.append(zone);
  });
}

function renderConcept(concept) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".concept-card");
  const appDemo = fragment.querySelector(".app-demo");
  const songZone = fragment.querySelector(".song-zone");
  const songTitle = fragment.querySelector("#song-zone-title");
  const uniqueSongTitle = `song-zone-title-${concept.id}`;

  card.dataset.family = concept.family;
  card.dataset.concept = concept.id;
  card.dataset.people = "4";
  card.id = `concept-${concept.number}`;
  appDemo.setAttribute("aria-label", `${concept.title} 인터랙티브 화면`);
  card.querySelector(".people-zone").setAttribute("aria-label", `${concept.title} 참여 인원`);
  card.querySelector(".estimate-zone").setAttribute("aria-label", `${concept.title} 약속 예상치`);
  card.querySelector(".demo-nav").setAttribute("aria-label", `${concept.title} 화면 탐색`);

  card.querySelector(".concept-index").textContent = concept.number;
  card.querySelector(".concept-family").textContent = concept.familyLabel;
  card.querySelector(".concept-title").textContent = concept.title;
  card.querySelector(".concept-thesis").textContent = concept.thesis;
  card.querySelector(".demo-label").textContent = concept.label;
  card.querySelector(".demo-headline").textContent = concept.headline;
  card.querySelector(".demo-copy").textContent = concept.copy;
  card.querySelector(".focus-button").setAttribute("aria-controls", card.id);

  songTitle.id = uniqueSongTitle;
  songZone.removeAttribute("aria-labelledby");
  songZone.setAttribute("aria-label", `${concept.title} 같이 부를 곡`);
  buildScene(card.querySelector(".space-scene"), concept);

  const songList = card.querySelector(".song-list");
  initialSongs.forEach((song, index) => songList.append(createSongRow(song, index)));

  grid.append(fragment);
  updateMetrics(document.querySelector(`#${card.id}`));
}

concepts.forEach(renderConcept);

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });

    document.querySelectorAll(".concept-card").forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.family !== filter;
    });
  });
});

function closeFocusedCard() {
  const focused = document.querySelector(".concept-card.is-focused");
  if (!focused) return;
  const button = focused.querySelector(".focus-button");
  focused.classList.remove("is-focused");
  document.body.classList.remove("focus-mode");
  button.setAttribute("aria-expanded", "false");
  button.querySelector("span").textContent = "크게 보기";
  button.focus({ preventScroll: true });
}

grid.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const card = target.closest(".concept-card");
  if (!card) return;

  if (target.closest(".focus-button")) {
    const alreadyFocused = card.classList.contains("is-focused");
    closeFocusedCard();
    if (!alreadyFocused) {
      const button = card.querySelector(".focus-button");
      card.classList.add("is-focused");
      document.body.classList.add("focus-mode");
      button.setAttribute("aria-expanded", "true");
      button.querySelector("span").textContent = "작게 보기";
      card.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "auto" : "smooth" });
    }
    return;
  }

  if (target.closest(".people-minus") || target.closest(".people-plus")) {
    const direction = target.closest(".people-plus") ? 1 : -1;
    const current = Number(card.dataset.people ?? 4);
    card.dataset.people = String(Math.min(8, Math.max(2, current + direction)));
    updateMetrics(card);
    return;
  }

  if (target.closest(".add-song")) {
    const list = card.querySelector(".song-list");
    const nextSong = extraSongs[list.children.length - initialSongs.length];
    if (nextSong) {
      list.append(createSongRow(nextSong, list.children.length));
      updateMetrics(card);
      list.lastElementChild?.animate(
        reducedMotion.matches
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: "translateY(8px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
        { duration: reducedMotion.matches ? 80 : 220, easing: "ease-out" },
      );
    }
    return;
  }

  const removeButton = target.closest(".remove-song");
  if (removeButton) {
    const list = card.querySelector(".song-list");
    if (list.children.length <= 1) return;
    removeButton.closest(".song-row")?.remove();
    renumberSongs(card);
    updateMetrics(card);
    return;
  }

  if (target.closest(".confirm-plan")) {
    openTicket(card, target.closest(".confirm-plan"));
  }
});

function openTicket(card, opener) {
  const concept = concepts.find((item) => item.id === card.dataset.concept);
  if (!concept) return;
  const metrics = getMetrics(card);
  dialogOpener = opener;

  document.querySelector("#ticket-serial").textContent = `NO. SPACE-${concept.number}`;
  document.querySelector("#ticket-space-name").textContent = concept.title;
  document.querySelector("#ticket-people").textContent = `${metrics.people}명`;
  document.querySelector("#ticket-songs").textContent = `${metrics.songs}곡`;
  document.querySelector("#ticket-time").textContent =
    `${metrics.minMinutes}–${metrics.maxMinutes}분`;
  document.querySelector("#ticket-cost").textContent =
    `${formatWon(metrics.minCost)}–${formatWon(metrics.maxCost)}`;
  document.querySelector("#copy-status").textContent = "";
  ticketDialog.showModal();
}

function closeTicket() {
  ticketDialog.close();
  dialogOpener?.focus({ preventScroll: true });
}

document.querySelectorAll(".dialog-close").forEach((button) => {
  button.addEventListener("click", closeTicket);
});

ticketDialog.addEventListener("click", (event) => {
  if (event.target === ticketDialog) closeTicket();
});

document.querySelector("#copy-ticket").addEventListener("click", async () => {
  const text = [
    "[싱송 약속 티켓]",
    document.querySelector("#ticket-space-name").textContent,
    "7월 26일 토요일 · 저녁 7:30",
    `${document.querySelector("#ticket-people").textContent} · ${document.querySelector("#ticket-songs").textContent}`,
    `${document.querySelector("#ticket-time").textContent} · ${document.querySelector("#ticket-cost").textContent}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "티켓 내용을 복사했어요.";
  } catch {
    document.querySelector("#copy-status").textContent =
      "이 브라우저에서는 자동 복사가 제한돼요. 티켓을 직접 선택해 주세요.";
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLAnchorElement && target.closest(".app-demo")) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ticketDialog.open) closeFocusedCard();
});
