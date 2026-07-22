(() => {
  const FIXTURE_SEED = 'AaBbCcDdEeFfGgHhIiJjKk';
  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const cards = [...document.querySelectorAll('.concept-card')];
  const canvases = [...document.querySelectorAll('.export-canvas')];
  const dialog = document.querySelector('#previewDialog');
  const previewStage = document.querySelector('#previewStage');
  const previewTitle = document.querySelector('#previewTitle');
  const closePreview = document.querySelector('.close-preview');
  const toast = document.querySelector('.toast');
  const params = new URLSearchParams(window.location.search);
  let toastTimer;

  const barcodeWidths = (seedText, bars = 24) => {
    let seed = 0;
    for (const character of seedText) {
      seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
    }

    return Array.from({ length: bars }, () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return 1 + (seed % 4);
    });
  };

  const widths = barcodeWidths(FIXTURE_SEED);
  document.querySelectorAll('.barcode').forEach((barcode) => {
    const fragment = document.createDocumentFragment();
    widths.forEach((width) => {
      const bar = document.createElement('span');
      bar.style.width = `${width}px`;
      fragment.append(bar);
    });
    barcode.replaceChildren(fragment);
  });

  const exportIndex = Number.parseInt(params.get('export') || '', 10);
  if (Number.isInteger(exportIndex) && exportIndex >= 1 && exportIndex <= canvases.length) {
    const host = document.createElement('main');
    host.className = 'export-host';
    host.append(canvases[exportIndex - 1].cloneNode(true));
    document.body.className = 'export-mode';
    document.body.replaceChildren(host);
    document.title = `SingSong Ticket ${String(exportIndex).padStart(2, '0')}`;
    return;
  }

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  };

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      cards.forEach((card) => {
        card.hidden = filter !== 'all' && !card.dataset.tags.split(' ').includes(filter);
      });
    });
  });

  cards.forEach((card) => {
    const openButton = card.querySelector('.open-preview');
    const title = card.querySelector('h2').textContent;
    openButton.addEventListener('click', () => {
      previewStage.replaceChildren(card.querySelector('.export-canvas').cloneNode(true));
      previewTitle.textContent = title;
      dialog.showModal();
      closePreview.focus();
    });
  });

  closePreview.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelectorAll('.concept-actions a').forEach((link) => {
    link.addEventListener('click', () => showToast('1080×1350 PNG를 내려받습니다.'));
  });

  if (params.has('capture')) document.body.classList.add('capture-mode');

  const previewIndex = Number.parseInt(params.get('preview') || '', 10);
  if (Number.isInteger(previewIndex) && previewIndex >= 1 && previewIndex <= cards.length) {
    cards[previewIndex - 1].querySelector('.open-preview').click();
  }

  if (params.has('selftest')) {
    const requiredText = [
      '싱송 SESSION TICKET',
      '8곡',
      '약 20~40분',
      '약 10,000~20,000원',
      '약 2,500~5,000원',
      '4명',
      '시간 요금',
      '길이 데이터 0%',
      '2026.07.21',
      'SS-20260721-08',
    ];
    const semanticFailures = [];
    const semanticPass = canvases.every((canvas, index) => {
      const ticket = canvas.querySelector('article.ticket');
      const text = ticket.textContent.replace(/\s+/g, ' ');
      const missing = requiredText.filter((value) => !text.includes(value));
      const passed = Boolean(ticket && ticket.querySelector('h3') && ticket.querySelector('dl') && missing.length === 0);
      if (!passed) semanticFailures.push(`${index + 1}:${missing.join('|') || 'structure'}`);
      return passed;
    });
    const decorationPass = canvases.every((canvas) => (
      canvas.dataset.artworkSeed === FIXTURE_SEED
      && canvas.querySelectorAll('.perforation').length === 1
      && canvas.querySelectorAll('.perforation > i').length === 2
      && canvas.querySelectorAll('.barcode > span').length === 24
      && canvas.querySelectorAll('[role="img"], .qr').length === 0
    ));
    document.querySelector('[data-filter="split"]').click();
    const splitFilterPass = cards.filter((card) => !card.hidden).length === 4;
    document.querySelector('[data-filter="all"]').click();
    cards[1].querySelector('.open-preview').click();
    const previewPass = dialog.open && previewStage.querySelectorAll('.export-canvas').length === 1;
    dialog.close();
    const layoutPass = document.documentElement.scrollWidth <= window.innerWidth;

    document.body.dataset.selftestSemantic = String(semanticPass);
    document.body.dataset.selftestDecoration = String(decorationPass);
    document.body.dataset.selftestFilter = String(splitFilterPass);
    document.body.dataset.selftestPreview = String(previewPass);
    document.body.dataset.selftestLayout = String(layoutPass);
    document.body.dataset.selftestFailures = semanticFailures.join(',') || 'none';
    document.body.dataset.selftest = semanticPass && decorationPass && splitFilterPass && previewPass && layoutPass ? 'pass' : 'fail';
  }
})();
