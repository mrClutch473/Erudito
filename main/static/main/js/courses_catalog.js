/* ============================
   ERUDITO — COURSES CATALOG JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── REVEAL НА СКРОЛЛЕ ──────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), Math.min(idx * 60, 300));
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


  // ── CURSOR GLOW ────────────────────────────────
  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed;width:300px;height:300px;border-radius:50%;
      background:radial-gradient(circle,rgba(201,168,76,0.05),transparent 70%);
      pointer-events:none;z-index:9999;transform:translate(-50%,-50%);
      transition:left 0.12s ease,top 0.12s ease;will-change:left,top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }


  // ── ПОИСК — live поиск с задержкой ────────────
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('clearSearch');
  let searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => applyFilters(), 400);

      // Показать/скрыть кнопку очистки
      if (clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
      }
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        applyFilters();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
    });
  }


  // ── ПЕРЕКЛЮЧАТЕЛЬ ВИД ─────────────────────────
  const grid    = document.getElementById('coursesGrid');
  const btnGrid = document.getElementById('viewGrid');
  const btnList = document.getElementById('viewList');

  let currentView = localStorage.getItem('catalogView') || 'grid';

  function setView(view) {
    currentView = view;
    localStorage.setItem('catalogView', view);

    if (view === 'list') {
      grid?.classList.add('cat-grid--list');
      btnList?.classList.add('cat-view-btn--active');
      btnGrid?.classList.remove('cat-view-btn--active');
    } else {
      grid?.classList.remove('cat-grid--list');
      btnGrid?.classList.add('cat-view-btn--active');
      btnList?.classList.remove('cat-view-btn--active');
    }
  }

  // Восстановить сохранённый вид
  setView(currentView);

  btnGrid?.addEventListener('click', () => setView('grid'));
  btnList?.addEventListener('click', () => setView('list'));


  // ── ПРИМЕНИТЬ ФИЛЬТРЫ ─────────────────────────
  window.applyFilters = () => {
    const params = new URLSearchParams(window.location.search);

    const q     = searchInput?.value.trim();
    const level = document.getElementById('levelSelect')?.value;
    const sort  = document.getElementById('sortSelect')?.value;

    // Обновляем или удаляем параметры
    q     ? params.set('q',     q)     : params.delete('q');
    level ? params.set('level', level) : params.delete('level');
    sort  ? params.set('sort',  sort)  : params.delete('sort');

    // Категория берётся из текущего URL если есть
    const newUrl = `${BASE_URL}?${params.toString()}`;
    window.location.href = newUrl;
  };


  // ── ПЛАВНОЕ ПОЯВЛЕНИЕ КАРТОЧЕК ────────────────
  // Стаггер для карточек при первой загрузке
  document.querySelectorAll('.cat-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 40}ms`;
  });

});
