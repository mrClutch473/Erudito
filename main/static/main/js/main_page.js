/* ============================
   ERUDITO — MAIN SCRIPT
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── NAVBAR SCROLL ──────────────────────────────────────────
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // ── BURGER MENU ────────────────────────────────────────────
  const burger     = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  // ── REVEAL ON SCROLL ───────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
        const idx   = siblings.indexOf(entry.target);
        const delay = Math.min(idx * 80, 400);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => revealObserver.observe(el));

  // ── COUNTER ANIMATION ──────────────────────────────────────
  const statNums = document.querySelectorAll('.stat-num');
  const easeOut  = (t) => 1 - Math.pow(1 - t, 3);

  function animateCounter(el) {
    const target   = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const start    = performance.now();

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.floor(easeOut(progress) * target);
      el.textContent = target >= 10000 ? value.toLocaleString('ru-RU') : value;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target >= 10000 ? target.toLocaleString('ru-RU') : target;
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

  statNums.forEach(el => counterObserver.observe(el));

  // ── MOCKUP PROGRESS BAR ────────────────────────────────────
  const mockupBar = document.getElementById('mockupBar');
  if (mockupBar) {
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mockupBar.style.width = '68%';
          barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    barObserver.observe(mockupBar);
  }

  // ── COURSE TABS FILTER ─────────────────────────────────────
  const cards = document.querySelectorAll('.cat-card');
  let activeCategory = 'all';
  let activeLevel    = 'all';

  function filterCards() {
    let visibleIndex = 0;
    cards.forEach(card => {
      const catMatch   = activeCategory === 'all' || card.dataset.category === activeCategory;
      const levelMatch = activeLevel    === 'all' || card.dataset.level    === activeLevel;
      const visible    = catMatch && levelMatch;

      if (visible) {
        card.style.display = '';
        const delay = visibleIndex * 60;
        visibleIndex++;
        card.style.transition = 'none';
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(18px) scale(0.97)';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            card.style.transition = `opacity 0.38s ease ${delay}ms, transform 0.38s ease ${delay}ms`;
            card.style.opacity    = '1';
            card.style.transform  = 'translateY(0) scale(1)';
          });
        });
      } else {
        card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(8px) scale(0.97)';
        setTimeout(() => {
          if (card.style.opacity === '0') card.style.display = 'none';
        }, 240);
      }
    });
  }

  document.querySelectorAll('#tabsCategory .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabsCategory .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.tab;
      filterCards();
    });
  });

  document.querySelectorAll('#tabsLevel .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabsLevel .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeLevel = tab.dataset.level;
      filterCards();
    });
  });

  // ── SMOOTH ACTIVE NAV LINK ─────────────────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.style.color = link.getAttribute('href') === `#${id}` ? 'var(--gold)' : '';
        });
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px' });

  sections.forEach(sec => sectionObserver.observe(sec));

  // ── CURSOR GLOW (desktop only) ─────────────────────────────
  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position: fixed; width: 300px; height: 300px; border-radius: 50%;
      background: radial-gradient(circle, rgba(201,168,76,0.06), transparent 70%);
      pointer-events: none; z-index: 9999; transform: translate(-50%, -50%);
      transition: left 0.12s ease, top 0.12s ease; will-change: left, top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  // ══════════════════════════════════════════════════════════
  //  AUTH MODALS
  // ══════════════════════════════════════════════════════════
  const modalLogin    = document.getElementById('modalLogin');
  const modalRegister = document.getElementById('modalRegister');

  if (!modalLogin || !modalRegister) return; // Модалок нет на этой странице

  function openModal(modal) {
    [modalLogin, modalRegister].forEach(m => m.classList.remove('modal-active'));
    document.body.classList.add('modal-open');
    modal.classList.add('modal-active');
    setTimeout(() => {
      const first = modal.querySelector('.mf-input');
      if (first) first.focus();
    }, 80);
  }

  function closeModal(modal) {
    modal.classList.remove('modal-active');
    document.body.classList.remove('modal-open');
  }

  // ── Глобальный хендлер data-open-modal + data-role ────────
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-open-modal]');
    if (!trigger) return;
    e.preventDefault();
    const target = trigger.dataset.openModal;
    if (target === 'register') openModal(modalRegister);
    if (target === 'login')    openModal(modalLogin);

    // Переключаем role-toggle если указан data-role
    const role = trigger.dataset.role;
    if (role && target === 'register') {
      document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
      });
      const ri = document.getElementById('roleInput');
      if (ri) ri.value = role;
    }
  });

  // ── Прямые триггеры по id ──────────────────────────────────
  document.getElementById('btnLogin')?.addEventListener('click', e => {
    e.preventDefault(); openModal(modalLogin);
  });
  document.getElementById('btnRegister')?.addEventListener('click', e => {
    e.preventDefault(); openModal(modalRegister);
  });
  document.getElementById('btnRegisterMobile')?.addEventListener('click', e => {
    e.preventDefault();
    mobileMenu?.classList.remove('open');
    openModal(modalRegister);
  });
  // Кнопка «Войди чтобы записаться» на странице курса
  document.getElementById('btnEnrollLogin')?.addEventListener('click', e => {
    e.preventDefault(); openModal(modalLogin);
  });

  // ── Закрытие ──────────────────────────────────────────────
  document.getElementById('closeLogin')?.addEventListener('click',    () => closeModal(modalLogin));
  document.getElementById('closeRegister')?.addEventListener('click', () => closeModal(modalRegister));

  [modalLogin, modalRegister].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') [modalLogin, modalRegister].forEach(m => closeModal(m));
  });

  // ── Переключение между модалами ───────────────────────────
  document.getElementById('switchToRegister')?.addEventListener('click', () => openModal(modalRegister));
  document.getElementById('switchToLogin')?.addEventListener('click',    () => openModal(modalLogin));

  // ── Role Toggle ───────────────────────────────────────────
  const roleToggle = document.getElementById('roleToggle');
  const roleInput  = document.getElementById('roleInput');

  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      if (roleInput)  roleInput.value      = role;
      if (roleToggle) roleToggle.dataset.active = role;
    });
  });

  // ── Password visibility ───────────────────────────────────
  document.querySelectorAll('.mf-toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input  = document.getElementById(btn.dataset.target);
      if (!input) return;
      const hidden = input.type === 'password';
      input.type   = hidden ? 'text' : 'password';
      btn.textContent = hidden ? '🙈' : '👁';
    });
  });

  // ── Live validation ───────────────────────────────────────
  document.querySelectorAll('.mf-input').forEach(input => {
    input.addEventListener('blur', () => {
      input.classList.remove('error', 'success');
      if (!input.value.trim()) return;
      input.classList.add(input.checkValidity() ? 'success' : 'error');
    });
    input.addEventListener('input', () => {
      if (input.classList.contains('error') && input.checkValidity()) {
        input.classList.replace('error', 'success');
      }
    });
  });

  // ── AJAX отправка форм ────────────────────────────────────
  function clearFormErrors(form) {
    form.querySelectorAll('.mf-error-text').forEach(el => el.remove());
    form.querySelectorAll('.mf-form-error').forEach(el => el.remove());
    form.querySelectorAll('.mf-input').forEach(el => el.classList.remove('error', 'success'));
  }

  function showFieldError(form, fieldName, message) {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (!input) return;
    input.classList.add('error');
    const wrap = input.closest('.mf-group');
    if (!wrap) return;
    const err = document.createElement('div');
    err.className   = 'mf-error-text';
    err.textContent = message;
    wrap.appendChild(err);
  }

  function showFormError(form, message) {
    const err = document.createElement('div');
    err.className   = 'mf-form-error';
    err.textContent = message;
    const btn = form.querySelector('.btn-modal-submit');
    form.insertBefore(err, btn);
  }

  async function submitForm(form, submitBtn) {
    clearFormErrors(form);
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Подождите...';
    submitBtn.disabled    = true;

    try {
      const response = await fetch(form.action, {
        method:  'POST',
        body:    new FormData(form),
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (response.ok) {
        window.location.href = '/';
      } else {
        const data = await response.json();
        if (data.errors) {
          Object.entries(data.errors).forEach(([field, message]) => {
            showFieldError(form, field, message);
          });
        } else if (data.error) {
          showFormError(form, data.error);
        }
      }
    } catch (e) {
      showFormError(form, 'Что-то пошло не так. Попробуй ещё раз.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled    = false;
    }
  }

  document.getElementById('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(e.target, e.target.querySelector('.btn-modal-submit'));
  });

  document.getElementById('registerForm')?.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(e.target, e.target.querySelector('.btn-modal-submit'));
  });

});
