/* ============================
   ERUDITO — TEACHER COURSES JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── REVEAL ON SCROLL ───────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), Math.min(idx * 80, 400));
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  reveals.forEach(el => revealObserver.observe(el));


  // ── CURSOR GLOW ────────────────────────────────
  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed; width:300px; height:300px; border-radius:50%;
      background:radial-gradient(circle,rgba(201,168,76,0.05),transparent 70%);
      pointer-events:none; z-index:9999; transform:translate(-50%,-50%);
      transition:left 0.12s ease,top 0.12s ease; will-change:left,top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }


  // ── МОДАЛЬНЫЕ ОКНА ─────────────────────────────
  const modalCreate = document.getElementById('modalCreateCourse');
  const modalDelete = document.getElementById('modalDelete');

  function openModal(modal) {
    modal.classList.add('modal-active');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    modal.classList.remove('modal-active');
    document.body.classList.remove('modal-open');
  }

  // Открытие создания курса
  document.getElementById('btnCreateCourse')?.addEventListener('click', () => {
    resetSteps();
    openModal(modalCreate);
  });

  document.getElementById('btnCreateCourseEmpty')?.addEventListener('click', () => {
    resetSteps();
    openModal(modalCreate);
  });

  // Закрытие
  document.getElementById('closeCreateCourse')?.addEventListener('click', () => closeModal(modalCreate));

  // Клик на backdrop
  [modalCreate, modalDelete].forEach(modal => {
    modal?.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(modalCreate);
      closeModal(modalDelete);
    }
  });


  // ── ШАГИ ФОРМЫ ─────────────────────────────────
  let currentStep = 1;
  const totalSteps = 3;

  function goToStep(step) {
    // Скрыть текущую панель
    document.getElementById(`step${currentStep}`)?.classList.remove('active');

    // Обновить индикаторы
    document.querySelectorAll('.cs-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('active', 'done');
      if (s === step) el.classList.add('active');
      if (s < step)  el.classList.add('done');
    });

    // Обновить линии
    document.querySelectorAll('.cs-line').forEach((line, i) => {
      line.classList.toggle('filled', i < step - 1);
    });

    // Показать новую панель
    currentStep = step;
    document.getElementById(`step${currentStep}`)?.classList.add('active');

    // Скролл в начало модалки
    document.getElementById('modalCourseBox')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetSteps() {
    currentStep = 1;
    goToStep(1);
  }

  // Делаем функции глобальными (вызываются из onclick в HTML)
  window.nextStep = (step) => {
    if (validateStep(currentStep)) goToStep(step);
  };

  window.prevStep = (step) => goToStep(step);


  // ── ВАЛИДАЦИЯ ШАГОВ ────────────────────────────
  function validateStep(step) {
    if (step === 1) {
      const title = document.querySelector('[name="title"]');
      const desc  = document.querySelector('[name="description"]');
      let ok = true;

      [title, desc].forEach(input => {
        input.classList.remove('error');
        if (!input.value.trim()) {
          input.classList.add('error');
          input.style.animation = 'shake 0.35s ease';
          setTimeout(() => input.style.animation = '', 400);
          ok = false;
        }
      });

      return ok;
    }

    if (step === 2) {
      const cat   = document.querySelector('[name="category"]:checked');
      const level = document.querySelector('[name="level"]:checked');

      if (!cat || !level) {
        // Подсветить незаполненное
        if (!cat) {
          document.querySelector('.category-picker').style.animation = 'shake 0.35s ease';
          setTimeout(() => document.querySelector('.category-picker').style.animation = '', 400);
        }
        return false;
      }
      return true;
    }

    return true;
  }


  // ── ЗАГРУЗКА ОБЛОЖКИ ───────────────────────────
  const fileDrop     = document.getElementById('fileDrop');
  const fileInput    = document.getElementById('thumbnailInput');
  const filePreview  = document.getElementById('filePreview');
  const previewImg   = document.getElementById('previewImg');
  const fileRemove   = document.getElementById('fileRemove');
  const fileContent  = fileDrop?.querySelector('.file-drop-content');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) showPreview(file);
    });
  }

  if (fileDrop) {
    fileDrop.addEventListener('dragover', e => {
      e.preventDefault();
      fileDrop.classList.add('drag-over');
    });
    fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));
    fileDrop.addEventListener('drop', e => {
      e.preventDefault();
      fileDrop.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        showPreview(file);
      }
    });
  }

  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      fileContent.style.display = 'none';
      filePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  fileRemove?.addEventListener('click', e => {
    e.stopPropagation();
    fileInput.value = '';
    previewImg.src = '';
    fileContent.style.display = 'flex';
    filePreview.style.display = 'none';
  });


  // ── ОТПРАВКА ФОРМЫ СОЗДАНИЯ ─────────────────────
  document.getElementById('createCourseForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    const form    = e.target;
    const btn     = form.querySelector('.btn-modal-submit');
    const origTxt = btn.textContent;

    btn.textContent = 'Создаём...';
    btn.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (response.ok) {
        // Анимация успеха
        btn.textContent = '✓ Готово!';
        btn.style.background = '#4ade80';
        btn.style.color = '#0a0a0f';
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await response.json();
        btn.textContent = origTxt;
        btn.disabled = false;
        alert(data.error || 'Ошибка при создании курса');
      }
    } catch {
      btn.textContent = origTxt;
      btn.disabled = false;
    }
  });


  // ── УДАЛЕНИЕ КУРСА ─────────────────────────────
  window.confirmDelete = (courseId, courseTitle) => {
    document.getElementById('deleteCourseTitle').textContent = `"${courseTitle}"`;
    document.getElementById('deleteForm').action = `/teacher/courses/${courseId}/delete/`;
    openModal(modalDelete);
  };

  window.closeDeleteModal = () => closeModal(modalDelete);


  // ── Анимация shake ─────────────────────────────
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(shakeStyle);

});
