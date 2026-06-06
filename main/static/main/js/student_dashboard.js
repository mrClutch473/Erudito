/* ============================
   ERUDITO — STUDENT DASHBOARD JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── REVEAL НА СКРОЛЛЕ ──────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), Math.min(idx * 80, 400));
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

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


  // ── СЧЁТЧИКИ СТАТИСТИКИ ────────────────────────
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function animateCounter(el) {
    const target   = parseInt(el.dataset.target, 10) || 0;
    const duration = 1400;
    const start    = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = Math.floor(easeOut(progress) * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.tsc-value[data-target]').forEach(el => {
    counterObserver.observe(el);
  });


  // ── АНИМАЦИЯ ПРОГРЕСС-БАРОВ ────────────────────
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill  = entry.target;
        const width = fill.dataset.width || '0';
        // Небольшая задержка чтобы transition сработал красиво
        setTimeout(() => { fill.style.width = width + '%'; }, 150);
        progressObserver.unobserve(fill);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.sd-progress-fill').forEach(el => {
    progressObserver.observe(el);
  });


  // ── МОДАЛЬНОЕ: ОТПИСАТЬСЯ ─────────────────────
  const modalUnenroll = document.getElementById('modalUnenroll');

  window.confirmUnenroll = (enrollmentId, courseTitle) => {
    document.getElementById('unenrollCourseName').textContent = `"${courseTitle}"`;
    document.getElementById('unenrollForm').action = `/student/unenroll/${enrollmentId}/`;
    modalUnenroll.classList.add('modal-active');
    document.body.classList.add('modal-open');
  };

  window.closeUnenrollModal = () => {
    modalUnenroll.classList.remove('modal-active');
    document.body.classList.remove('modal-open');
  };

  modalUnenroll?.addEventListener('click', e => {
    if (e.target === modalUnenroll) closeUnenrollModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeUnenrollModal();
  });


  // ── АНИМАЦИЯ shake ─────────────────────────────
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
  `;
  document.head.appendChild(shakeStyle);

});
