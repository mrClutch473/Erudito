/* ============================
   ERUDITO — COURSE DETAIL JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── REVEAL НА СКРОЛЛЕ ──────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), Math.min(idx * 70, 350));
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


  // ── АНИМАЦИЯ ПРОГРЕСС-БАРА ЗАПИСИ ──────────────
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill  = entry.target;
        const width = fill.dataset.width || '0';
        setTimeout(() => { fill.style.width = width + '%'; }, 200);
        progressObserver.unobserve(fill);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.cd-card-progress-fill').forEach(el => {
    progressObserver.observe(el);
  });


  // ── АККОРДЕОН УРОКОВ ───────────────────────────
  window.toggleLesson = (btn) => {
    const item = btn.closest('.cd-lesson-item');
    const body = item.querySelector('.cd-lesson-body');
    if (!body) return;

    const isOpen = item.classList.contains('is-open');

    // Закрыть все открытые (опционально — один за раз)
    document.querySelectorAll('.cd-lesson-item.is-open').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('is-open');
        const b = openItem.querySelector('.cd-lesson-body');
        if (b) b.style.maxHeight = '0';
      }
    });

    if (isOpen) {
      item.classList.remove('is-open');
      body.style.maxHeight = '0';
    } else {
      item.classList.add('is-open');
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  };


  // ── TOAST СИСТЕМА ──────────────────────────────
  let toastTimer = null;

  window.showToast = (message, type = 'success') => {
    const toast    = document.getElementById('cdToast');
    const toastTxt = document.getElementById('cdToastText');
    const toastIco = document.getElementById('cdToastIcon');

    toast.classList.remove('cd-toast--success', 'cd-toast--error');
    toast.classList.add(`cd-toast--${type}`);
    toastIco.textContent = type === 'success' ? '✓' : '✕';
    toastTxt.textContent = message;

    toast.classList.add('cd-toast--show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('cd-toast--show'), 4000);
  };


  // ── AJAX ЗАПИСЬ НА КУРС ─────────────────────────
  window.enrollCourse = async (courseId) => {
    const btn = document.getElementById('enrollBtn');
    if (!btn) return;

    // Анимация кнопки
    const original = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:0.7">Записываемся...</span>';
    btn.disabled  = true;

    try {
      const resp = await fetch(ENROLL_URL, {
        method: 'POST',
        headers: {
          'X-CSRFToken':     CSRF_TOKEN,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const data = await resp.json();

      if (data.success) {
        // Успех — обновляем UI без перезагрузки
        btn.innerHTML = '✓ Вы записаны на курс';
        btn.classList.add('cd-btn-enroll--enrolled');
        btn.onclick = null;
        btn.disabled = false;

        // Добавляем кнопку дашборда
        const ctaWrap = btn.closest('.cd-cta-wrap');
        if (ctaWrap) {
          const dashBtn = document.createElement('a');
          dashBtn.href      = '/student/dashboard/';
          dashBtn.className = 'cd-btn-dashboard';
          dashBtn.textContent = '📚 Перейти к обучению';
          ctaWrap.insertBefore(dashBtn, btn.nextSibling);

          // Кнопка отписки
          const unenrollBtn = document.createElement('button');
          unenrollBtn.className   = 'cd-btn-unenroll';
          unenrollBtn.textContent = 'Отписаться от курса';
          unenrollBtn.onclick     = openUnenrollModal;
          ctaWrap.appendChild(unenrollBtn);
        }

        showToast(data.message || 'Ты успешно записан на курс!', 'success');
      } else {
        btn.innerHTML = original;
        btn.disabled  = false;
        showToast(data.message || 'Произошла ошибка', 'error');
      }
    } catch (e) {
      btn.innerHTML = original;
      btn.disabled  = false;
      showToast('Что-то пошло не так. Попробуй ещё раз.', 'error');
    }
  };


  // ── МОДАЛЬНОЕ: ОТПИСКА ─────────────────────────
  const modalUnenroll = document.getElementById('modalUnenroll');

  window.openUnenrollModal = () => {
    if (!modalUnenroll) return;
    modalUnenroll.classList.add('modal-active');
    document.body.classList.add('modal-open');
  };

  window.closeUnenrollModal = () => {
    if (!modalUnenroll) return;
    modalUnenroll.classList.remove('modal-active');
    document.body.classList.remove('modal-open');
  };

  modalUnenroll?.addEventListener('click', e => {
    if (e.target === modalUnenroll) closeUnenrollModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeUnenrollModal();
  });


  // ── ПЛАВНАЯ АНИМАЦИЯ КАРТОЧЕК УЧЕБНОГО ПЛАНА ───
  // Стаггер при первой загрузке
  document.querySelectorAll('.cd-lesson-item').forEach((item, i) => {
    item.style.transitionDelay = `${i * 30}ms`;
    item.style.opacity = '0';
    item.style.transform = 'translateX(-12px)';

    setTimeout(() => {
      item.style.transition = 'opacity 0.4s ease, transform 0.4s ease, border-color 0.35s ease';
      item.style.opacity    = '1';
      item.style.transform  = 'translateX(0)';
    }, 400 + i * 40);
  });

  // Сбросить transition-delay после анимации
  setTimeout(() => {
    document.querySelectorAll('.cd-lesson-item').forEach(item => {
      item.style.transitionDelay = '';
    });
  }, 400 + document.querySelectorAll('.cd-lesson-item').length * 40 + 500);


  // ── СЧЁТЧИКИ В STAT-КАРТОЧКАХ ──────────────────
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function animateNum(el, target, duration = 1200) {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.floor(easeOut(p) * target);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const val = parseInt(entry.target.dataset.count, 10);
        if (!isNaN(val)) animateNum(entry.target, val);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.cd-card-stat-value[data-count]').forEach(el => {
    counterObserver.observe(el);
  });

});
