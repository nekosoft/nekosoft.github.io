(() => {
  const slides = [...document.querySelectorAll('.slide')].filter(slide => !slide.dataset.title.startsWith('Phase 2 — Why the CSV'));
  slides.forEach(slide => {
    const match = slide.dataset.title.match(/^Phase ([3-6])\b/);
    if (!match) return;
    const visiblePhase = Number(match[1]) - 1;
    slide.dataset.title = slide.dataset.title.replace(/^Phase [3-6]/, `Phase ${visiblePhase}`);
    const chip = slide.querySelector('.phase-chip');
    if (chip) chip.textContent = `Phase ${visiblePhase}`;
  });
  const progress = document.getElementById('progressBar');
  const current = document.getElementById('currentNumber');
  const total = document.getElementById('totalNumber');
  const prev = document.getElementById('prevButton');
  const next = document.getElementById('nextButton');
  const menu = document.getElementById('slideMenu');
  const menuButton = document.getElementById('menuButton');
  const closeMenu = document.getElementById('closeMenu');
  const links = document.getElementById('slideLinks');
  let index = Math.max(0, Math.min(slides.length - 1, Number(location.hash.replace('#slide-', '')) - 1 || 0));

  total.textContent = slides.length;
  slides.forEach((slide, i) => {
    slide.tabIndex = -1;
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span>${slide.dataset.title}`;
    button.addEventListener('click', () => { show(i); setMenu(false); });
    links.appendChild(button);
  });

  function show(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    [...links.children].forEach((button, i) => button.classList.toggle('active', i === index));
    current.textContent = index + 1;
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    document.title = `${index + 1}. ${slides[index].dataset.title} — Roaming Bites`;
    if (updateHash) history.replaceState(null, '', `#slide-${index + 1}`);
    slides[index].focus({ preventScroll: true });
  }

  function setMenu(open) {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  }

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  menuButton.addEventListener('click', () => setMenu(menu.hidden));
  closeMenu.addEventListener('click', () => setMenu(false));
  document.getElementById('fullscreenButton').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); show(index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(index - 1); }
    if (event.key === 'Home') { event.preventDefault(); show(0); }
    if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
    if (event.key === 'Escape' && !menu.hidden) setMenu(false);
  });
  window.addEventListener('hashchange', () => show(Number(location.hash.replace('#slide-', '')) - 1 || 0, false));
  show(index, false);
})();
