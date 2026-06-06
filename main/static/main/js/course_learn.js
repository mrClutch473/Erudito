/* ============================
   ERUDITO — COURSE LEARN JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── CURSOR GLOW (desktop) ─────────────────────
  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed;width:260px;height:260px;border-radius:50%;
      background:radial-gradient(circle,rgba(201,168,76,0.045),transparent 70%);
      pointer-events:none;z-index:1;transform:translate(-50%,-50%);
      transition:left 0.1s ease,top 0.1s ease;will-change:left,top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  // ── ПРОГРЕСС-БАРЫ ─────────────────────────────
  setTimeout(() => {
    const sbFill = document.getElementById('sbFill');
    if (sbFill) sbFill.style.width = (sbFill.dataset.width || 0) + '%';
  }, 200);

  // ── МОБАЙЛ: САЙДБАР ───────────────────────────
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  const toggle   = document.getElementById('sidebarToggle');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  toggle?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  overlay?.addEventListener('click', closeSidebar);

  const activeRow = document.querySelector('.lp-lesson-row--active');
  if (activeRow) {
    setTimeout(() => {
      activeRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  }


  // ── TOAST ─────────────────────────────────────
  let toastTimer = null;

  window.showToast = (msg, type = 'success') => {
    const toast = document.getElementById('lpToast');
    const icon  = document.getElementById('lpToastIcon');
    const text  = document.getElementById('lpToastText');

    toast.classList.remove('lp-toast--success', 'lp-toast--error', 'lp-toast--info');
    toast.classList.add(`lp-toast--${type}`);
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    text.textContent = msg;

    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  };


  // ── ПОДСКАЗКА «УРОК ЗАБЛОКИРОВАН» ────────────
  window.showLockedHint = () => {
    showToast('Сначала завершите текущий урок', 'info');
    const btn = document.getElementById('doneBtn');
    if (btn) {
      btn.style.animation = 'none';
      btn.offsetHeight;
      btn.style.animation = 'lpShake 0.45s ease';
    }
  };


  // ── ПОМЕТИТЬ УРОК КАК ПРОЙДЕННЫЙ (AJAX) ──────
  window.markLessonDone = async () => {
    const btn = document.getElementById('doneBtn');
    if (!btn || LP.isCurrentDone) return;

    const orig = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:.65">Сохраняем...</span>';
    btn.disabled  = true;
    btn.style.transform = 'none';

    try {
      const resp = await fetch(LP.markDoneUrl, {
        method : 'POST',
        headers: {
          'X-CSRFToken'     : LP.csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!resp.ok) throw new Error('server');
      const data = await resp.json();

      if (data.success) {
        LP.isCurrentDone = true;

        btn.classList.remove('lp-done-btn--pending');
        btn.classList.add('lp-done-btn--completed');
        btn.innerHTML = '✓ Урок пройден';
        btn.disabled  = true;

        updateProgress(data.progress, data.lessons_done);

        const row = document.querySelector(`[data-lesson-id="${LP.currentLessonId}"]`);
        if (row) {
          row.classList.add('lp-lesson-row--done');
          const icon = row.querySelector('.lp-ls-icon');
          if (icon) {
            icon.className = 'lp-ls-icon lp-ls-icon--done';
            icon.textContent = '✓';
          }
        }

        const eyebrow = document.querySelector('.lp-lesson-eyebrow');
        if (eyebrow && !eyebrow.querySelector('.lp-done-badge')) {
          const badge = document.createElement('span');
          badge.className = 'lp-done-badge';
          badge.textContent = '✓ Пройден';
          eyebrow.appendChild(badge);
        }

        const nextLocked = document.getElementById('nextBtnLocked');
        if (nextLocked && LP.nextLessonUrl) {
          const nextLink = document.createElement('a');
          nextLink.href      = LP.nextLessonUrl;
          nextLink.className = 'lp-nav-btn';
          nextLink.id        = 'nextBtn';
          nextLink.innerHTML = 'Следующий →';
          nextLocked.replaceWith(nextLink);
        }

        if (data.completed) {
          setTimeout(() => showCompletion(), 700);
        } else {
          showToast('🎉 Отличная работа! Урок завершён.', 'success');
        }

      } else {
        throw new Error('fail');
      }

    } catch (e) {
      btn.innerHTML = orig;
      btn.disabled  = false;
      showToast('Не удалось сохранить — попробуй снова', 'error');
    }
  };


  // ── ОБНОВИТЬ ПРОГРЕСС ─────────────────────────
  function updateProgress(pct, done) {
    const tf = document.getElementById('topbarFill');
    const tp = document.getElementById('topbarPct');
    if (tf) tf.style.width = pct + '%';
    if (tp) tp.textContent  = pct + '%';

    const sf   = document.getElementById('sbFill');
    const sp   = document.getElementById('sbPct');
    const ssub = document.getElementById('sbSub');
    if (sf)   sf.style.width  = pct + '%';
    if (sp)   sp.textContent   = pct + '%';
    if (ssub) ssub.textContent = `${done} из ${LP.totalLessons} уроков пройдено`;
  }


  // ── ЭКРАН ЗАВЕРШЕНИЯ ─────────────────────────
  window.showCompletion = () => {
    const screen = document.getElementById('completionScreen');
    if (screen) screen.classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  window.closeCompletion = () => {
    const screen = document.getElementById('completionScreen');
    if (screen) screen.classList.remove('show');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCompletion();
  });


  // ── ЗАМЕТКИ ───────────────────────────────────
  const notesToggle = document.getElementById('notesToggle');
  const notesArea   = document.getElementById('notesArea');
  const notesSave   = document.getElementById('notesSave');
  const notesText   = document.getElementById('notesToggleText');

  if (notesArea) {
    const saved = localStorage.getItem(LP.notesKey);
    if (saved) {
      notesArea.value = saved;
      notesArea.classList.add('open');
      notesSave.classList.add('open');
      notesText.textContent = 'Моя заметка к уроку';
    }
  }

  notesToggle?.addEventListener('click', () => {
    const isOpen = notesArea.classList.contains('open');
    notesArea.classList.toggle('open', !isOpen);
    notesSave.classList.toggle('open', !isOpen);
    notesText.textContent = isOpen ? 'Добавить заметку к уроку' : 'Моя заметка к уроку';
    if (!isOpen) setTimeout(() => notesArea.focus(), 50);
  });

  notesSave?.addEventListener('click', () => {
    const val = notesArea.value.trim();
    if (val) {
      localStorage.setItem(LP.notesKey, val);
      showToast('📝 Заметка сохранена', 'success');
    } else {
      localStorage.removeItem(LP.notesKey);
      showToast('Заметка удалена', 'info');
    }
  });

  notesArea?.addEventListener('blur', () => {
    const val = notesArea.value.trim();
    if (val) localStorage.setItem(LP.notesKey, val);
    else localStorage.removeItem(LP.notesKey);
  });


  // ── КЛАВИШНЫЕ ШОРТКАТЫ ────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    if (e.key === 'ArrowLeft') {
      const prev = document.getElementById('prevBtn');
      if (prev && !prev.disabled) prev.click();
    }

    if (e.key === 'ArrowRight') {
      const next = document.getElementById('nextBtn');
      if (next && !next.disabled) next.click();
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const done = document.getElementById('doneBtn');
      if (done && !done.disabled) markLessonDone();
    }
  });


  // ── РЕНДЕРИНГ MARKDOWN ────────────────────────
  // Находим контейнер с текстом урока и рендерим его как Markdown
  const textBody = document.querySelector('.lp-text-body');
  if (textBody) {
    // Текст хранится в data-md атрибуте (сырой markdown)
    const scriptTag = document.getElementById('lessonTextData');
    const raw = scriptTag ? JSON.parse('"' + scriptTag.textContent.trim() + '"') : '';

    if (raw && raw.trim()) {
      if (window.marked) {
        // Настройка: переносы строк, GFM (GitHub Flavored Markdown)
        marked.setOptions({ breaks: true, gfm: true });
        textBody.innerHTML = marked.parse(raw);
        textBody.classList.add('lp-text-body--rendered');
      } else {
        // Fallback: просто отобразить как текст с переносами
        textBody.textContent = raw;
      }
    } else {
      // Текст пустой — скрыть блок
      const section = textBody.closest('.lp-text-section');
      if (section) section.style.display = 'none';
    }
  }


  // ── АНИМАЦИИ ──────────────────────────────────
  document.querySelectorAll('.lp-lesson-row').forEach((row, i) => {
    row.style.opacity   = '0';
    row.style.transform = 'translateX(-8px)';
    setTimeout(() => {
      row.style.transition = 'opacity 0.35s ease, transform 0.35s ease, background var(--transition)';
      row.style.opacity    = '1';
      row.style.transform  = 'translateX(0)';
    }, 120 + i * 35);
  });

  const contentItems = document.querySelectorAll(
    '.lp-lesson-header, .lp-video-wrap, .lp-video-placeholder, .lp-text-body, .lp-materials-grid, .lp-notes-section'
  );
  contentItems.forEach((el, i) => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(16px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    }, 80 + i * 70);
  });

  document.querySelectorAll('.lp-material-card').forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateX(-6px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease, border-color var(--transition)';
      card.style.opacity    = '1';
      card.style.transform  = 'translateX(0)';
    }, 300 + i * 60);
  });

});


/* ── CSS-анимация shake ── */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes lpShake {
    0%,100%{ transform: translateX(0) }
    20%    { transform: translateX(-5px) }
    40%    { transform: translateX(5px) }
    60%    { transform: translateX(-3px) }
    80%    { transform: translateX(3px) }
  }
`;
document.head.appendChild(shakeStyle);