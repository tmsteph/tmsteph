(() => {
  const STORAGE_KEY = 'tmsteph:pinned-apps:v1';
  const cards = [...document.querySelectorAll('[data-app]')];
  const reset = document.getElementById('reset-pins');
  const year = document.getElementById('year');

  if (year) year.textContent = new Date().getFullYear();

  const defaults = cards
    .filter(card => card.dataset.defaultPinned === 'true')
    .map(card => card.dataset.app);

  const loadPins = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : defaults;
    } catch {
      return defaults;
    }
  };

  let pins = loadPins();

  const render = () => {
    cards.forEach(card => {
      const id = card.dataset.app;
      const pinned = pins.includes(id);
      card.classList.toggle('is-pinned', pinned);
      const button = card.querySelector('.pin-button');
      if (!button) return;
      button.textContent = pinned ? '★' : '☆';
      button.setAttribute('aria-pressed', String(pinned));
      button.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${card.querySelector('h3')?.textContent || 'app'}`);
    });
  };

  cards.forEach(card => {
    card.querySelector('.pin-button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const id = card.dataset.app;
      pins = pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
      render();
    });
  });

  reset?.addEventListener('click', () => {
    pins = [...defaults];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    render();
  });

  render();
})();
