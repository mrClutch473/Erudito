/* ============================
   ERUDITO — TEACHER COURSE EDIT JS
   Данные уроков грузятся через AJAX из БД Django.
   Никаких глобальных LESSONS_DATA / LESSONS_TEXT.
   ============================ */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════
  // СОСТОЯНИЕ
  // ═══════════════════════════════════════════

  let currentLessonId = null;  // id открытого урока
  let pendingDeleteId = null;  // id урока к удалению
  let isDirty        = false;  // есть несохранённые изменения


  // ═══════════════════════════════════════════
  // REVEAL АНИМАЦИЯ
  // ═══════════════════════════════════════════

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
  }

  observeReveals();


  // ═══════════════════════════════════════════
  // CURSOR GLOW
  // ═══════════════════════════════════════════

  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed;width:300px;height:300px;border-radius:50%;
      background:radial-gradient(circle,rgba(201,168,76,0.04),transparent 70%);
      pointer-events:none;z-index:9998;transform:translate(-50%,-50%);
      transition:left 0.15s ease,top 0.15s ease;will-change:left,top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }


  // ═══════════════════════════════════════════
  // ТОСТЫ
  // ═══════════════════════════════════════════

  function showToast(message, type = 'info') {
    const icons     = { success: '✓', error: '✕', info: '✦' };
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }


  // ═══════════════════════════════════════════
  // МОДАЛЬНЫЕ ОКНА
  // ═══════════════════════════════════════════

  window.openModal = (id) => {
    document.getElementById(id).classList.add('modal-active');
    document.body.classList.add('modal-open');
  };

  window.closeModal = (id) => {
    document.getElementById(id).classList.remove('modal-active');
    document.body.classList.remove('modal-open');
  };

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.modal-active').forEach(m => closeModal(m.id));
    }
  });


  // ═══════════════════════════════════════════
  // MARKDOWN ТУЛБАР
  // ═══════════════════════════════════════════

  const textarea   = document.getElementById('fText');
  const mdPreview  = document.getElementById('mdPreview');
  const tabEdit    = document.getElementById('tabEdit');
  const tabPreview = document.getElementById('tabPreview');
  const editorWrap = document.getElementById('editorWrap');

  // Вставить Markdown-синтаксис в позицию курсора
  function insertMd(type) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const sel   = textarea.value.substring(start, end);
    const val   = textarea.value;

    let before = '';
    let after  = '';
    let placeholder = '';
    let selectPlaceholder = true;

    switch (type) {
      case 'h1':
        before = '\n# '; placeholder = sel || 'Заголовок 1'; after = '\n'; break;
      case 'h2':
        before = '\n## '; placeholder = sel || 'Заголовок 2'; after = '\n'; break;
      case 'h3':
        before = '\n### '; placeholder = sel || 'Заголовок 3'; after = '\n'; break;
      case 'bold':
        before = '**'; placeholder = sel || 'жирный текст'; after = '**'; break;
      case 'italic':
        before = '*'; placeholder = sel || 'курсив'; after = '*'; break;
      case 'ul':
        before = '\n- '; placeholder = sel || 'пункт списка'; after = '\n'; break;
      case 'ol':
        before = '\n1. '; placeholder = sel || 'пункт списка'; after = '\n'; break;
      case 'blockquote':
        before = '\n> '; placeholder = sel || 'цитата'; after = '\n'; break;
      case 'code':
        before = '`'; placeholder = sel || 'код'; after = '`'; break;
      case 'codeblock':
        before = '\n```\n'; placeholder = sel || 'код'; after = '\n```\n'; break;
      case 'link':
        before = '['; placeholder = sel || 'текст ссылки'; after = '](url)'; break;
      case 'hr':
        before = '\n\n---\n\n'; placeholder = ''; after = ''; selectPlaceholder = false; break;
    }

    const insert = before + placeholder + after;
    textarea.value = val.substring(0, start) + insert + val.substring(end);

    // Установить курсор внутрь плейсхолдера
    textarea.focus();
    if (selectPlaceholder && placeholder) {
      const selStart = start + before.length;
      const selEnd   = selStart + placeholder.length;
      textarea.setSelectionRange(selStart, selEnd);
    } else {
      const newPos = start + insert.length;
      textarea.setSelectionRange(newPos, newPos);
    }

    updateCharCount();
    isDirty = true;
  }

  // Привязать кнопки тулбара
  document.querySelectorAll('.md-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault(); // не снимать фокус с textarea
      insertMd(btn.dataset.md);
    });
  });

  // Ctrl+B / Ctrl+I в textarea
  textarea?.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); insertMd('bold'); }
      if (e.key === 'i') { e.preventDefault(); insertMd('italic'); }
    }
  });

  // Tab → вставить отступ (4 пробела) вместо смены фокуса
  textarea?.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const val   = textarea.value;
      textarea.value = val.substring(0, start) + '    ' + val.substring(end);
      textarea.setSelectionRange(start + 4, start + 4);
    }
  });

  // ── Переключение вкладок Editor / Preview ──

  function showEditorTab() {
    tabEdit.classList.add('md-tab--active');
    tabPreview.classList.remove('md-tab--active');
    editorWrap.style.display = '';
    mdPreview.style.display  = 'none';
  }

  function showPreviewTab() {
    tabPreview.classList.add('md-tab--active');
    tabEdit.classList.remove('md-tab--active');
    editorWrap.style.display = 'none';

    const raw = textarea?.value?.trim() || '';
    if (window.marked) {
      // Настройка marked: безопасный рендер
      marked.setOptions({ breaks: true, gfm: true });
      mdPreview.innerHTML = raw
        ? marked.parse(raw)
        : '<p class="md-preview-empty">Текст урока пустой — переключись на редактор и начни писать.</p>';
    } else {
      mdPreview.innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(raw)}</pre>`;
    }
    mdPreview.style.display = 'block';
  }

  tabEdit?.addEventListener('click', showEditorTab);
  tabPreview?.addEventListener('click', showPreviewTab);


  // ═══════════════════════════════════════════
  // ОТКРЫТИЕ УРОКА — AJAX запрос к Django
  // ═══════════════════════════════════════════

  async function openLesson(lessonId) {
    if (!lessonId) return;

    // Показать лоадер, скрыть редактор
    document.getElementById('lessonLoading').style.display = 'flex';
    document.getElementById('lessonEditor').style.display  = 'none';
    document.getElementById('editorEmpty').style.display   = 'none';

    // Подсветить активный в сайдбаре
    document.querySelectorAll('.lesson-item').forEach(item => {
      item.classList.toggle(
        'lesson-item--active',
        parseInt(item.dataset.lessonId) === lessonId
      );
    });

    try {
      const resp = await fetch(
        `/teacher/courses/${COURSE_ID}/lessons/${lessonId}/`,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );

      if (!resp.ok) {
        showToast('Не удалось загрузить урок', 'error');
        document.getElementById('lessonLoading').style.display = 'none';
        return;
      }

      const lesson = await resp.json();

      currentLessonId = lesson.id;
      document.getElementById('lessonId').value                 = lesson.id;
      document.getElementById('lessonOrderDisplay').textContent  = lesson.order;
      document.getElementById('fTitle').value                   = lesson.title    || '';
      document.getElementById('fOrder').value                   = lesson.order    || '';
      document.getElementById('fDuration').value                = lesson.duration || '';
      document.getElementById('fVideoUrl').value                = lesson.video_url || '';
      document.getElementById('fText').value                    = lesson.text     || '';

      updateCharCount();
      updateVideoPreview(lesson.video_url);
      renderMaterials(lesson.materials || []);
      cancelAddMaterial();

      // Сбросить вкладку превью на редактор при смене урока
      showEditorTab();

      isDirty = false;

    } catch {
      showToast('Ошибка сети при загрузке урока', 'error');
    } finally {
      document.getElementById('lessonLoading').style.display = 'none';
      document.getElementById('lessonEditor').style.display  = 'block';
      observeReveals();
    }
  }

  if (typeof FIRST_LESSON_ID !== 'undefined' && FIRST_LESSON_ID) {
    openLesson(FIRST_LESSON_ID);
  }

  document.getElementById('lessonsList').addEventListener('click', e => {
    const item = e.target.closest('.lesson-item');
    if (!item || e.target.closest('.lesson-item-delete')) return;

    const id = parseInt(item.dataset.lessonId);
    if (id === currentLessonId) return;

    if (isDirty && !confirm('Есть несохранённые изменения. Перейти без сохранения?')) return;

    openLesson(id);
  });


  // ═══════════════════════════════════════════
  // ВИДЕО ПРЕВЬЮ
  // ═══════════════════════════════════════════

  function updateVideoPreview(url) {
    const wrap = document.getElementById('videoPreviewWrap');
    const link = document.getElementById('videoPreviewLink');
    if (url && url.startsWith('http')) {
      wrap.style.display = 'block';
      link.href = url;
    } else {
      wrap.style.display = 'none';
    }
  }

  document.getElementById('fVideoUrl')?.addEventListener('blur', e => {
    updateVideoPreview(e.target.value);
  });


  // ═══════════════════════════════════════════
  // СЧЁТЧИК СИМВОЛОВ
  // ═══════════════════════════════════════════

  function updateCharCount() {
    const len = document.getElementById('fText')?.value.length || 0;
    document.getElementById('charCount').textContent = len.toLocaleString('ru-RU');
  }

  document.getElementById('fText')?.addEventListener('input', updateCharCount);


  // ═══════════════════════════════════════════
  // DIRTY TRACKING
  // ═══════════════════════════════════════════

  ['fTitle', 'fOrder', 'fDuration', 'fVideoUrl', 'fText'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { isDirty = true; });
  });


  // ═══════════════════════════════════════════
  // ДОБАВИТЬ УРОК
  // ═══════════════════════════════════════════

  document.getElementById('btnAddLesson')?.addEventListener('click', () => {
    document.getElementById('newLessonTitle').value = '';
    openModal('modalAddLesson');
    setTimeout(() => document.getElementById('newLessonTitle').focus(), 100);
  });

  document.getElementById('addLessonForm')?.addEventListener('submit', async e => {
    e.preventDefault();

    const title = document.getElementById('newLessonTitle').value.trim();
    if (!title) {
      document.getElementById('newLessonTitle').classList.add('error');
      return;
    }
    document.getElementById('newLessonTitle').classList.remove('error');

    const btn = e.target.querySelector('.btn-modal-submit');
    btn.textContent = 'Создаём...';
    btn.disabled    = true;

    try {
      const resp = await apiFetch(`/teacher/courses/${COURSE_ID}/lessons/create/`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      const lesson = await resp.json();

      if (resp.ok) {
        appendLessonItem(lesson);
        document.getElementById('lessonsEmpty')?.remove();
        closeModal('modalAddLesson');
        showToast('Урок создан!', 'success');
        openLesson(lesson.id);
      } else {
        showToast(lesson.error || 'Ошибка создания урока', 'error');
      }
    } catch {
      showToast('Ошибка сети', 'error');
    } finally {
      btn.textContent = '✦ Создать';
      btn.disabled    = false;
    }
  });

  function appendLessonItem(lesson) {
    const list = document.getElementById('lessonsList');
    const item = document.createElement('div');
    item.className        = 'lesson-item';
    item.dataset.lessonId = lesson.id;
    item.draggable        = true;
    item.innerHTML = `
      <div class="lesson-item-drag">⠿</div>
      <div class="lesson-item-body">
        <div class="lesson-item-order">Урок ${lesson.order}</div>
        <div class="lesson-item-title">${escapeHtml(lesson.title)}</div>
        <div class="lesson-item-meta"></div>
      </div>
      <button class="lesson-item-delete" title="Удалить урок"
              onclick="confirmDeleteLesson(${lesson.id}, '${escapeJs(lesson.title)}')">✕</button>
    `;
    list.appendChild(item);
    initDragForItem(item);
  }

  function updateSidebarItem(lesson) {
    const item = document.querySelector(`.lesson-item[data-lesson-id="${lesson.id}"]`);
    if (!item) return;

    item.querySelector('.lesson-item-order').textContent = `Урок ${lesson.order}`;
    item.querySelector('.lesson-item-title').textContent  = lesson.title;

    const meta = [
      lesson.duration        ? `⏱ ${lesson.duration} мин` : '',
      lesson.video_url       ? '🎬' : '',
      lesson.materials_count ? `📎 ${lesson.materials_count}` : '',
    ].filter(Boolean).join(' · ');

    item.querySelector('.lesson-item-meta').textContent = meta;
    item.querySelector('.lesson-item-delete').setAttribute(
      'onclick', `confirmDeleteLesson(${lesson.id}, '${escapeJs(lesson.title)}')`
    );
  }


  // ═══════════════════════════════════════════
  // СОХРАНИТЬ УРОК
  // ═══════════════════════════════════════════

  window.saveLesson = async () => {
    if (!currentLessonId) return;

    const btn      = document.getElementById('btnSaveLesson');
    const origHTML = btn.innerHTML;
    btn.innerHTML  = '⏳ Сохраняем...';
    btn.disabled   = true;

    const payload = {
      title:     document.getElementById('fTitle').value.trim(),
      order:     parseInt(document.getElementById('fOrder').value)    || 1,
      duration:  parseInt(document.getElementById('fDuration').value) || 0,
      video_url: document.getElementById('fVideoUrl').value.trim(),
      text:      document.getElementById('fText').value,
    };

    if (!payload.title) {
      const el = document.getElementById('fTitle');
      el.classList.add('error');
      el.style.animation = 'shake 0.35s ease';
      setTimeout(() => el.style.animation = '', 400);
      btn.innerHTML = origHTML;
      btn.disabled  = false;
      showToast('Введите название урока', 'error');
      return;
    }

    document.getElementById('fTitle').classList.remove('error');

    try {
      const resp = await apiFetch(
        `/teacher/courses/${COURSE_ID}/lessons/${currentLessonId}/update/`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      const data = await resp.json();

      if (resp.ok) {
        updateSidebarItem(data.lesson);
        document.getElementById('lessonOrderDisplay').textContent = data.lesson.order;
        isDirty = false;

        btn.innerHTML        = '✓ Сохранено!';
        btn.style.background = '#4ade80';
        btn.style.color      = '#0a0a0f';
        setTimeout(() => {
          btn.innerHTML        = origHTML;
          btn.style.background = '';
          btn.style.color      = '';
          btn.disabled         = false;
        }, 1800);

        showToast('Урок сохранён', 'success');
      } else {
        showToast(data.error || 'Ошибка сохранения', 'error');
        btn.innerHTML = origHTML;
        btn.disabled  = false;
      }
    } catch {
      showToast('Ошибка сети', 'error');
      btn.innerHTML = origHTML;
      btn.disabled  = false;
    }
  };

  // Ctrl+S / Cmd+S
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveLesson();
    }
  });


  // ═══════════════════════════════════════════
  // УДАЛИТЬ УРОК
  // ═══════════════════════════════════════════

  window.confirmDeleteLesson = (lessonId, lessonTitle) => {
    pendingDeleteId = lessonId;
    document.getElementById('deleteLessonName').textContent = `"${lessonTitle}"`;
    openModal('modalDeleteLesson');
  };

  window.deleteCurrentLesson = () => {
    if (!currentLessonId) return;
    const item  = document.querySelector(`.lesson-item[data-lesson-id="${currentLessonId}"]`);
    const title = item?.querySelector('.lesson-item-title')?.textContent || '';
    confirmDeleteLesson(currentLessonId, title);
  };

  document.getElementById('btnConfirmDeleteLesson')?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    const btn     = document.getElementById('btnConfirmDeleteLesson');
    btn.textContent = 'Удаляем...';
    btn.disabled    = true;

    try {
      const resp = await apiFetch(
        `/teacher/courses/${COURSE_ID}/lessons/${pendingDeleteId}/delete/`,
        { method: 'POST' }
      );
      const data = await resp.json();

      if (resp.ok) {
        document.querySelector(`.lesson-item[data-lesson-id="${pendingDeleteId}"]`)?.remove();
        closeModal('modalDeleteLesson');
        showToast('Урок удалён', 'info');

        if (data.next_lesson_id) {
          currentLessonId = null;
          openLesson(data.next_lesson_id);
        } else {
          currentLessonId = null;
          document.getElementById('lessonEditor').style.display = 'none';
          document.getElementById('editorEmpty').style.display  = 'flex';

          const list = document.getElementById('lessonsList');
          if (!list.querySelector('.lessons-empty')) {
            list.innerHTML = `
              <div class="lessons-empty" id="lessonsEmpty">
                <div class="le-icon">📋</div>
                <p>Уроков пока нет.<br/>Добавь первый!</p>
              </div>`;
          }
        }

        pendingDeleteId = null;
      } else {
        showToast('Ошибка удаления', 'error');
      }
    } catch {
      showToast('Ошибка сети', 'error');
    } finally {
      btn.textContent = 'Удалить';
      btn.disabled    = false;
    }
  });


  // ═══════════════════════════════════════════
  // МАТЕРИАЛЫ
  // ═══════════════════════════════════════════

  const TYPE_ICONS  = { pdf: '📄', link: '🔗', file: '📎' };
  const TYPE_LABELS = { pdf: 'PDF файл', link: 'Ссылка', file: 'Файл' };

  function renderMaterials(materials) {
    const list = document.getElementById('materialsList');
    list.innerHTML = '';

    if (!materials || materials.length === 0) {
      list.innerHTML = `
        <div class="materials-empty" id="materialsEmpty">
          <span class="materials-empty-icon">📎</span>
          <span>Материалы не добавлены</span>
        </div>`;
    } else {
      materials.forEach(mat => list.appendChild(createMaterialEl(mat)));
    }

    document.getElementById('materialsCount').textContent = materials ? materials.length : 0;
  }

  function createMaterialEl(mat) {
    const el = document.createElement('div');
    el.className = 'material-item';
    el.dataset.materialId = mat.id;

    const link = mat.url || mat.file;
    const openBtn = link
      ? `<a class="material-btn material-btn--open" href="${escapeHtml(link)}"
            target="_blank" rel="noopener" title="Открыть">↗</a>`
      : '';

    el.innerHTML = `
      <div class="material-type-icon">${TYPE_ICONS[mat.type] || '📎'}</div>
      <div class="material-info">
        <div class="material-title">${escapeHtml(mat.title)}</div>
        <div class="material-type-label">${TYPE_LABELS[mat.type] || mat.type}${link ? ` · <span class="material-url-preview">${escapeHtml(link.length > 40 ? link.substring(0, 40) + '…' : link)}</span>` : ''}</div>
      </div>
      <div class="material-actions">
        ${openBtn}
        <button class="material-btn material-btn--delete" title="Удалить"
                onclick="removeMaterial(${mat.id})">✕</button>
      </div>`;

    // Анимация появления
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    return el;
  }

  // Открыть форму добавления
  document.getElementById('btnAddMaterial')?.addEventListener('click', () => {
    document.getElementById('addMaterialForm').style.display = 'flex';
    document.getElementById('btnAddMaterial').style.display  = 'none';
    // Убрать пустое состояние если есть
    document.getElementById('materialsEmpty')?.remove();
    setTimeout(() => document.getElementById('newMaterialTitle').focus(), 50);
  });

  // Отмена
  window.cancelAddMaterial = () => {
    document.getElementById('addMaterialForm').style.display = 'none';
    document.getElementById('btnAddMaterial').style.display  = '';
    document.getElementById('newMaterialTitle').value        = '';
    document.getElementById('newMaterialUrl').value          = '';
    document.getElementById('materialFileInput').value       = '';
    document.getElementById('newMaterialTitle').classList.remove('error');
    document.getElementById('newMaterialUrl').classList.remove('error');

    // Сбросить состояние файла
    resetFileDropState();

    // Сбросить превью ссылки
    const linkPreview = document.getElementById('materialLinkPreview');
    if (linkPreview) linkPreview.style.display = 'none';

    // Вернуть пустое состояние если список пуст
    const list = document.getElementById('materialsList');
    if (list && !list.children.length) {
      list.innerHTML = `
        <div class="materials-empty" id="materialsEmpty">
          <span class="materials-empty-icon">📎</span>
          <span>Материалы не добавлены</span>
        </div>`;
    }
  };

  // ── Состояние файла ─────────────────────────────────────────
  function resetFileDropState() {
    const drop    = document.getElementById('materialFileDrop');
    const content = drop?.querySelector('.file-drop-content');
    const success = drop?.querySelector('.file-drop-success');
    if (content) content.style.display = 'flex';
    if (success) success.remove();
    if (drop) drop.classList.remove('file-drop--selected');
  }

  document.getElementById('materialFileInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    const drop = document.getElementById('materialFileDrop');
    if (!drop) return;

    const content = drop.querySelector('.file-drop-content');

    if (file) {
      // Убрать старый success если был
      drop.querySelector('.file-drop-success')?.remove();

      // Определить тип файла
      const ext = file.name.split('.').pop().toUpperCase();
      const size = file.size < 1024 * 1024
        ? (file.size / 1024).toFixed(1) + ' КБ'
        : (file.size / (1024 * 1024)).toFixed(1) + ' МБ';

      const successEl = document.createElement('div');
      successEl.className = 'file-drop-success';
      successEl.innerHTML = `
        <div class="fds-icon">✓</div>
        <div class="fds-info">
          <div class="fds-name">${escapeHtml(file.name.length > 32 ? file.name.substring(0, 32) + '…' : file.name)}</div>
          <div class="fds-meta">${ext} · ${size}</div>
        </div>
        <button type="button" class="fds-remove" id="fdsRemove" title="Убрать файл">✕</button>
      `;

      content.style.display = 'none';
      drop.appendChild(successEl);
      drop.classList.add('file-drop--selected');

      // Кнопка удаления файла
      successEl.querySelector('#fdsRemove').addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('materialFileInput').value = '';
        resetFileDropState();
      });

    } else {
      resetFileDropState();
    }
  });

  // ── Превью ссылки ────────────────────────────────────────────
  document.getElementById('newMaterialUrl')?.addEventListener('input', e => {
    const val     = e.target.value.trim();
    const preview = document.getElementById('materialLinkPreview');
    if (!preview) return;

    if (val.startsWith('http')) {
      try {
        const u = new URL(val);
        preview.querySelector('.mlp-domain').textContent = u.hostname;
        preview.style.display = 'flex';
      } catch {
        preview.style.display = 'none';
      }
    } else {
      preview.style.display = 'none';
    }
  });

  // Переключение табов типа материала
  document.querySelectorAll('.amf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.amf-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const type   = tab.dataset.type;
      const isFile = type === 'pdf' || type === 'file';
      document.getElementById('newMaterialType').value          = type;
      document.getElementById('materialFileWrap').style.display = isFile ? 'block' : 'none';
      document.getElementById('materialLinkWrap').style.display = isFile ? 'none'  : 'block';

      // Сброс значений при переключении
      document.getElementById('newMaterialUrl').value   = '';
      document.getElementById('materialFileInput').value = '';
    });
  });

  // Добавить материал
  window.addMaterial = async () => {
    if (!currentLessonId) return;

    const titleEl = document.getElementById('newMaterialTitle');
    const title   = titleEl.value.trim();
    const type    = document.getElementById('newMaterialType').value;
    const url     = document.getElementById('newMaterialUrl').value.trim();
    const file    = document.getElementById('materialFileInput').files[0];
    const btn     = document.querySelector('.amf-confirm');

    // Валидация названия
    if (!title) {
      titleEl.classList.add('error');
      titleEl.focus();
      showToast('Введите название материала', 'error');
      return;
    }
    titleEl.classList.remove('error');

    // Валидация URL для ссылки
    if (type === 'link' && !url) {
      document.getElementById('newMaterialUrl').classList.add('error');
      document.getElementById('newMaterialUrl').focus();
      showToast('Введите ссылку', 'error');
      return;
    }
    document.getElementById('newMaterialUrl').classList.remove('error');

    // Состояние загрузки
    const origText = btn.textContent;
    btn.textContent = 'Сохраняем...';
    btn.disabled = true;

    try {
      let resp;

      if ((type === 'pdf' || type === 'file') && file) {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('type', type);
        fd.append('file', file);
        resp = await fetch(
          `/teacher/courses/${COURSE_ID}/lessons/${currentLessonId}/materials/create/`,
          { method: 'POST', headers: { 'X-CSRFToken': getCsrf() }, body: fd }
        );
      } else {
        resp = await apiFetch(
          `/teacher/courses/${COURSE_ID}/lessons/${currentLessonId}/materials/create/`,
          { method: 'POST', body: JSON.stringify({ title, type, url }) }
        );
      }

      const mat = await resp.json();

      if (resp.ok) {
        // Убрать пустое состояние
        document.getElementById('materialsEmpty')?.remove();

        // Добавить карточку в список
        document.getElementById('materialsList').appendChild(createMaterialEl(mat));

        // Обновить счётчик
        const cnt = document.getElementById('materialsCount');
        const newCount = parseInt(cnt.textContent || '0') + 1;
        cnt.textContent = newCount;

        // Анимация счётчика
        cnt.style.transform = 'scale(1.3)';
        setTimeout(() => cnt.style.transform = '', 250);

        // ← СНАЧАЛА сбрасываем кнопку, потом cancelAddMaterial
        btn.textContent = origText;
        btn.disabled    = false;

        cancelAddMaterial();
        showToast(`✓ Материал «${title}» добавлен`, 'success');

        // Обновить мета в сайдбаре
        updateSidebarMaterialsMeta(currentLessonId, newCount);

      } else {
        showToast(mat.error || 'Ошибка добавления', 'error');
        btn.textContent = origText;
        btn.disabled = false;
      }
    } catch {
      showToast('Ошибка сети', 'error');
      btn.textContent = origText;
      btn.disabled = false;
    }
  };

  // Обновить мету материалов в сайдбаре
  function updateSidebarMaterialsMeta(lessonId, count) {
    const sidebarItem = document.querySelector(`.lesson-item[data-lesson-id="${lessonId}"]`);
    if (!sidebarItem) return;
    const metaEl = sidebarItem.querySelector('.lesson-item-meta');
    if (!metaEl) return;

    const text = metaEl.textContent;
    if (/📎 \d+/.test(text)) {
      metaEl.textContent = text.replace(/📎 \d+/, `📎 ${count}`);
    } else {
      metaEl.textContent = (text.trim() ? text + ' · ' : '') + `📎 ${count}`;
    }
  }

  // Удалить материал
  window.removeMaterial = async (matId) => {
    if (!currentLessonId) return;

    const item = document.querySelector(`.material-item[data-material-id="${matId}"]`);
    if (!item) return;

    // Анимация исчезновения
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(8px)';

    try {
      const resp = await apiFetch(
        `/teacher/courses/${COURSE_ID}/lessons/${currentLessonId}/materials/${matId}/delete/`,
        { method: 'POST' }
      );

      if (resp.ok) {
        item.remove();

        const cnt = document.getElementById('materialsCount');
        const newCount = Math.max(0, parseInt(cnt.textContent || '0') - 1);
        cnt.textContent = newCount;

        // Показать пустое состояние если материалов не осталось
        const list = document.getElementById('materialsList');
        if (list && !list.children.length) {
          list.innerHTML = `
            <div class="materials-empty" id="materialsEmpty">
              <span class="materials-empty-icon">📎</span>
              <span>Материалы не добавлены</span>
            </div>`;
        }

        showToast('Материал удалён', 'info');
        updateSidebarMaterialsMeta(currentLessonId, newCount);

      } else {
        // Вернуть видимость если ошибка
        item.style.opacity   = '1';
        item.style.transform = '';
        showToast('Ошибка удаления', 'error');
      }
    } catch {
      item.style.opacity   = '1';
      item.style.transform = '';
      showToast('Ошибка сети', 'error');
    }
  };


  // ═══════════════════════════════════════════
  // DRAG AND DROP УРОКОВ
  // ═══════════════════════════════════════════

  let dragSrc = null;

  function initDragForItem(item) {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('lesson-item--dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('lesson-item--dragging');
      document.querySelectorAll('.lesson-item--drag-over').forEach(el => {
        el.classList.remove('lesson-item--drag-over');
      });
      dragSrc = null;
      saveOrder();
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== item) {
        document.querySelectorAll('.lesson-item--drag-over').forEach(el => {
          el.classList.remove('lesson-item--drag-over');
        });
        item.classList.add('lesson-item--drag-over');
      }
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== item) {
        if (dragSrc.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) {
          item.after(dragSrc);
        } else {
          item.before(dragSrc);
        }
      }
    });
  }

  document.querySelectorAll('.lesson-item').forEach(initDragForItem);

  async function saveOrder() {
    const items = [...document.querySelectorAll('.lesson-item')];
    const order = items.map((el, idx) => ({
      id:    parseInt(el.dataset.lessonId),
      order: idx + 1,
    }));

    items.forEach((el, idx) => {
      el.querySelector('.lesson-item-order').textContent = `Урок ${idx + 1}`;
    });

    try {
      await apiFetch(`/teacher/courses/${COURSE_ID}/lessons/reorder/`, {
        method: 'POST',
        body: JSON.stringify({ order }),
      });
    } catch { /* молча */ }
  }


  // ═══════════════════════════════════════════
  // ХЕЛПЕРЫ
  // ═══════════════════════════════════════════

  function getCsrf() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
  }

  function apiFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers || {}),
      },
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJs(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  // Стили shake + spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
    .lesson-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: calc(100vh - 65px);
      color: var(--white-dim);
      font-size: 14px;
    }
    .loading-spinner {
      width: 32px; height: 32px;
      border: 2px solid var(--border-dim);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

});