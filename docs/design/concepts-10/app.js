(() => {
  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const cards = [...document.querySelectorAll('.concept-card')];
  const dialog = document.querySelector('#previewDialog');
  const previewStage = document.querySelector('#previewStage');
  const previewTitle = document.querySelector('#previewTitle');
  const closePreview = document.querySelector('.close-preview');
  const toast = document.querySelector('.toast');
  let toastTimer;

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
        const tags = card.dataset.tags.split(' ');
        card.hidden = filter !== 'all' && !tags.includes(filter);
      });
    });
  });

  cards.forEach((card) => {
    const openButton = card.querySelector('.open-preview');
    const cardTitle = card.querySelector('h2').textContent;
    const phone = card.querySelector('.phone');

    openButton.addEventListener('click', () => {
      previewStage.replaceChildren(phone.cloneNode(true));
      previewTitle.textContent = cardTitle;
      dialog.showModal();
      dialog.querySelector('.close-preview').focus();
    });

    card.querySelectorAll('.mock-action').forEach((action) => {
      action.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showToast(`${cardTitle} · ${action.textContent.trim()} 흐름을 보여주는 시안입니다.`);
      });
    });

    card.querySelectorAll('.mobile-bottom nav a').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showToast(`${cardTitle} · 비교 보드에서는 화면 이동을 생략했어요.`);
      });
    });
  });

  closePreview.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  previewStage.addEventListener('click', (event) => {
    const action = event.target.closest('.mock-action, nav a');
    if (!action) return;
    event.preventDefault();
    showToast(`${previewTitle.textContent} · 인터랙션 위치를 확인했습니다.`);
  });

  const params = new URLSearchParams(window.location.search);

  if (params.has('capture')) {
    document.body.classList.add('capture-mode');
  }

  if (params.has('preview')) {
    cards[0].querySelector('.open-preview').click();
  }

  if (params.has('selftest')) {
    const darkFilter = document.querySelector('[data-filter="dark"]');
    const allFilter = document.querySelector('[data-filter="all"]');

    darkFilter.click();
    const darkCountIsCorrect = cards.filter((card) => !card.hidden).length === 4;
    allFilter.click();
    const allCountIsCorrect = cards.filter((card) => !card.hidden).length === 10;
    cards[0].querySelector('.open-preview').click();
    const previewOpened = dialog.open && previewStage.querySelectorAll('.phone').length === 1;
    dialog.close();

    document.body.dataset.selftest = darkCountIsCorrect && allCountIsCorrect && previewOpened ? 'pass' : 'fail';
  }
})();
