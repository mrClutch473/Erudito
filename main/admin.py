from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.db.models import Count, Avg, Sum
from django.urls import reverse
from django.utils import timezone
import nested_admin

from .models import (
    User, Course, Introduction, Lesson, LessonMaterial,
    Enrollment, LessonProgress, Review
)


# ══════════════════════════════════════════════════════════════
#  ХЕЛПЕРЫ
# ══════════════════════════════════════════════════════════════

def _progress_bar(pct, label=''):
    color = '#4ade80' if pct == 100 else '#c9a84c' if pct >= 50 else '#f87171'
    text  = label or f'{pct}%'
    return format_html(
        '<div class="er-progress-outer">'
        '  <div class="er-progress-track">'
        '    <div class="er-progress-fill" style="width:{pct}%;background:{color};"></div>'
        '  </div>'
        '  <span class="er-progress-label">{text}</span>'
        '</div>',
        pct=pct, color=color, text=text,
    )


def _badge(text, bg, color='#0a0a0f'):
    return format_html(
        '<span class="er-badge" style="background:{};color:{};">{}</span>',
        bg, color, text,
    )


def _stars(rating):
    filled = '★' * rating
    empty  = '☆' * (5 - rating)
    colors = {1: '#f87171', 2: '#fb923c', 3: '#fbbf24', 4: '#a3e635', 5: '#4ade80'}
    color  = colors.get(rating, '#c9a84c')
    return format_html(
        '<span class="er-stars er-stars--filled" style="color:{};">{}</span>'
        '<span class="er-stars er-stars--empty">{}</span>',
        color, filled, empty,
    )


def _video_link(url, label='▶ Смотреть'):
    """Стилизованная ссылка на видео."""
    if not url:
        return format_html('<span class="er-text-faint">—</span>')
    return format_html(
        '<a class="er-video-link" href="{}" target="_blank" rel="noopener">'
        '<span class="er-video-icon">▶</span>{}'
        '</a>',
        url, label,
    )


ADMIN_CSS = {'all': ('admin/css/erudito_admin.css',)}


# ══════════════════════════════════════════════════════════════
#  BULK ACTIONS
# ══════════════════════════════════════════════════════════════

def _action_activate(modeladmin, request, qs):
    updated = qs.update(is_active=True)
    modeladmin.message_user(request, f'Активировано пользователей: {updated}.')
_action_activate.short_description = '✓ Активировать выбранных'


def _action_deactivate(modeladmin, request, qs):
    updated = qs.exclude(is_superuser=True).update(is_active=False)
    modeladmin.message_user(request, f'Заблокировано пользователей: {updated}.')
_action_deactivate.short_description = '✗ Заблокировать выбранных'


def _action_publish(modeladmin, request, qs):
    updated = qs.update(is_published=True)
    modeladmin.message_user(request, f'Опубликовано курсов: {updated}.')
_action_publish.short_description = '▶ Опубликовать выбранные'


def _action_unpublish(modeladmin, request, qs):
    updated = qs.update(is_published=False)
    modeladmin.message_user(request, f'Снято с публикации курсов: {updated}.')
_action_unpublish.short_description = '⏸ Снять с публикации'


def _action_mark_enrollments_complete(modeladmin, request, qs):
    updated = 0
    for enrollment in qs.filter(is_completed=False):
        enrollment.is_completed = True
        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=['is_completed', 'completed_at'])
        updated += 1
    modeladmin.message_user(request, f'Отмечено завершёнными: {updated} записей.')
_action_mark_enrollments_complete.short_description = '✓ Отметить завершёнными'


def _action_reset_enrollment_progress(modeladmin, request, qs):
    count = 0
    for enrollment in qs:
        enrollment.lesson_progresses.all().delete()
        enrollment.is_completed = False
        enrollment.completed_at = None
        enrollment.save(update_fields=['is_completed', 'completed_at'])
        count += 1
    modeladmin.message_user(request, f'Прогресс сброшен у {count} записей.')
_action_reset_enrollment_progress.short_description = '↺ Сбросить прогресс'


def _action_mark_lessons_done(modeladmin, request, qs):
    updated = 0
    for lp in qs.filter(is_done=False):
        lp.mark_done()
        updated += 1
    modeladmin.message_user(request, f'Отмечено пройденными: {updated} уроков.')
_action_mark_lessons_done.short_description = '✓ Отметить пройденными'


def _action_mark_lessons_undone(modeladmin, request, qs):
    updated = qs.filter(is_done=True).update(is_done=False, done_at=None)
    modeladmin.message_user(request, f'Сброшено: {updated} уроков.')
_action_mark_lessons_undone.short_description = '↺ Сбросить прохождение'


# ══════════════════════════════════════════════════════════════
#  USER
# ══════════════════════════════════════════════════════════════

@admin.register(User)
class UserAdmin(BaseUserAdmin):

    actions          = [_action_activate, _action_deactivate]
    list_display     = ('avatar_placeholder', 'email_display', 'full_name',
                        'role_badge', 'courses_or_enrollments',
                        'is_active_icon', 'date_joined_fmt')
    list_display_links = ('avatar_placeholder', 'email_display')
    list_filter      = ('role', 'is_staff', 'is_superuser', 'is_active')
    search_fields    = ('email', 'first_name', 'last_name')
    ordering         = ('-date_joined',)
    list_per_page    = 25
    show_full_result_count = False

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Личные данные', {'fields': ('first_name', 'last_name', 'role')}),
        ('Права доступа', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        ('Даты', {
            'fields': ('last_login', 'date_joined'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )

    filter_horizontal = ('groups', 'user_permissions')
    readonly_fields   = ('date_joined', 'last_login')

    # ── display-методы ──────────────────────────────────────

    @admin.display(description='')
    def avatar_placeholder(self, obj):
        """Иконка-аватар с инициалами пользователя."""
        initials = ''
        if obj.first_name:
            initials += obj.first_name[0].upper()
        if obj.last_name:
            initials += obj.last_name[0].upper()
        if not initials:
            initials = obj.email[0].upper()

        bg_colors = {
            'teacher': 'rgba(99,102,241,0.25)',
            'student': 'rgba(14,165,233,0.2)',
        }
        text_colors = {
            'teacher': '#a5b4fc',
            'student': '#7dd3fc',
        }
        bg   = bg_colors.get(obj.role, 'rgba(201,168,76,0.15)')
        color = text_colors.get(obj.role, '#c9a84c')

        return format_html(
            '<div class="er-avatar" style="background:{};color:{};">{}</div>',
            bg, color, initials,
        )

    @admin.display(description='Email', ordering='email')
    def email_display(self, obj):
        return format_html('<span class="er-email">{}</span>', obj.email)

    @admin.display(description='Имя', ordering='first_name')
    def full_name(self, obj):
        name = obj.get_full_name() or '—'
        return format_html('<span class="er-name">{}</span>', name)

    @admin.display(description='Роль')
    def role_badge(self, obj):
        if obj.role == 'teacher':
            return _badge('Преподаватель', 'rgba(99,102,241,0.2)', '#a5b4fc')
        return _badge('Студент', 'rgba(14,165,233,0.15)', '#7dd3fc')

    @admin.display(description='Активность')
    def courses_or_enrollments(self, obj):
        if obj.role == 'teacher':
            count = obj.courses.count()
            label = 'курс' if count % 10 == 1 and count % 100 != 11 else 'курсов'
            return format_html('<span class="er-stat">📚 {} {}</span>', count, label)
        total = obj.enrollments.count()
        done  = obj.enrollments.filter(is_completed=True).count()
        return format_html('<span class="er-stat">🎓 {}/{}</span>', done, total)

    @admin.display(description='Статус')
    def is_active_icon(self, obj):
        if obj.is_active:
            return format_html('<span class="er-status er-status--ok">● Активен</span>')
        return format_html('<span class="er-status er-status--off">○ Заблокирован</span>')

    @admin.display(description='Регистрация', ordering='date_joined')
    def date_joined_fmt(self, obj):
        return format_html(
            '<span class="er-date">{}</span>',
            obj.date_joined.strftime('%d.%m.%Y'),
        )

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  INLINES для CourseAdmin
# ══════════════════════════════════════════════════════════════

class LessonMaterialInline(nested_admin.NestedTabularInline):
    model               = LessonMaterial
    extra               = 0
    fields              = ('title', 'type', 'file', 'url')
    verbose_name        = 'Материал'
    verbose_name_plural = 'Материалы'
    classes             = ('collapse',)


class LessonInline(nested_admin.NestedStackedInline):
    model               = Lesson
    extra               = 0
    inlines             = [LessonMaterialInline]
    fields              = ('title', 'order', 'duration', 'video_url', 'text')
    ordering            = ('order',)
    classes             = ('collapse',)
    verbose_name        = 'Урок'
    verbose_name_plural = 'Уроки'
    show_change_link    = True


class IntroductionInline(nested_admin.NestedStackedInline):
    model               = Introduction
    extra               = 0
    max_num             = 1
    fields              = ('title', 'text', 'video_url')
    classes             = ('collapse',)
    verbose_name        = 'Введение'
    verbose_name_plural = 'Введение'


# ══════════════════════════════════════════════════════════════
#  COURSE
# ══════════════════════════════════════════════════════════════

@admin.register(Course)
class CourseAdmin(nested_admin.NestedModelAdmin):

    inlines            = [IntroductionInline, LessonInline]
    actions            = [_action_publish, _action_unpublish]

    list_display       = ('thumbnail_col', 'title_display', 'teacher_link',
                          'category_badge', 'level_badge', 'lessons_count',
                          'students_count', 'avg_rating_display',
                          'is_published', 'created_at_fmt')
    list_display_links = ('thumbnail_col', 'title_display')
    list_filter        = ('is_published', 'category', 'level', 'teacher')
    search_fields      = ('title', 'description',
                          'teacher__email', 'teacher__first_name', 'teacher__last_name')
    list_editable      = ('is_published',)
    list_per_page      = 20
    date_hierarchy     = 'created_at'
    ordering           = ('-created_at',)
    save_on_top        = True
    show_full_result_count = False

    fieldsets = (
        ('Основное', {
            'fields': ('title', 'description'),
        }),
        ('Обложка', {
            'fields': ('thumbnail', 'thumbnail_preview'),
        }),
        ('Параметры', {
            'fields': ('category', 'level', 'teacher', 'is_published'),
            'classes': ('wide',),
        }),
        ('Даты (авто)', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ('created_at', 'updated_at', 'thumbnail_preview')
    autocomplete_fields = ['teacher']

    # ── display-методы ──────────────────────────────────────

    @admin.display(description='Обложка')
    def thumbnail_col(self, obj):
        if obj.thumbnail:
            return format_html(
                '<img class="er-thumb" src="{}" alt="{}">',
                obj.thumbnail.url, obj.title,
            )
        return format_html(
            '<div class="er-thumb-placeholder">'
            '<span>{}</span>'
            '</div>',
            obj.get_category_display()[0].upper(),
        )

    @admin.display(description='Предпросмотр обложки')
    def thumbnail_preview(self, obj):
        if obj.thumbnail:
            return format_html(
                '<img class="er-thumb-preview" src="{}" alt="{}">',
                obj.thumbnail.url, obj.title,
            )
        return format_html('<span class="er-text-faint">Обложка не загружена</span>')

    @admin.display(description='Название', ordering='title')
    def title_display(self, obj):
        status = ''
        if not obj.is_published:
            status = format_html(' <span class="er-badge er-badge--draft">черновик</span>')
        return format_html('<span class="er-title">{}</span>{}', obj.title, status)

    @admin.display(description='Преподаватель', ordering='teacher__first_name')
    def teacher_link(self, obj):
        url  = reverse('admin:main_user_change', args=[obj.teacher.pk])
        name = obj.teacher.get_full_name() or obj.teacher.email
        return format_html('<a class="er-link" href="{}">{}</a>', url, name)

    @admin.display(description='Категория', ordering='category')
    def category_badge(self, obj):
        styles = {
            'dev':    ('rgba(99,102,241,0.18)',  '#a5b4fc'),
            'design': ('rgba(139,92,246,0.18)',  '#c4b5fd'),
            'data':   ('rgba(14,165,233,0.18)',  '#7dd3fc'),
        }
        bg, color = styles.get(obj.category, ('#333', '#ccc'))
        return _badge(obj.get_category_display(), bg, color)

    @admin.display(description='Уровень', ordering='level')
    def level_badge(self, obj):
        styles = {
            'beginner':     ('rgba(74,222,128,0.15)',  '#86efac'),
            'intermediate': ('rgba(251,191,36,0.15)',  '#fcd34d'),
            'advanced':     ('rgba(248,113,113,0.15)', '#fca5a5'),
        }
        bg, color = styles.get(obj.level, ('#333', '#ccc'))
        return _badge(obj.get_level_display(), bg, color)

    @admin.display(description='Уроков', ordering='_lessons_count')
    def lessons_count(self, obj):
        total_dur = obj.lessons.aggregate(s=Sum('duration'))['s'] or 0
        return format_html(
            '<span class="er-num">📖 {}</span>'
            '<br><span class="er-date">⏱ {} мин</span>',
            obj._lessons_count, total_dur,
        )

    @admin.display(description='Студентов', ordering='_students_count')
    def students_count(self, obj):
        return format_html('<span class="er-num">👤 {}</span>', obj._students_count)

    @admin.display(description='Рейтинг', ordering='_avg_rating')
    def avg_rating_display(self, obj):
        avg = obj._avg_rating
        if not avg:
            return format_html('<span class="er-text-faint">—</span>')
        filled = round(avg)
        stars = '★' * filled + '☆' * (5 - filled)
        avg_str = f'{avg:.1f}'
        return format_html(
            '<span title="{}/5" style="color:#fbbf24;font-size:13px;letter-spacing:1px;">{}</span>'
            '<br><span class="er-date">{} / 5</span>',
            avg_str, stars, avg_str,
        )

    @admin.display(description='Создан', ordering='created_at')
    def created_at_fmt(self, obj):
        return format_html(
            '<span class="er-date">{}</span>',
            obj.created_at.strftime('%d.%m.%Y'),
        )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('teacher').prefetch_related('lessons').annotate(
            _lessons_count=Count('lessons', distinct=True),
            _students_count=Count('enrollments', distinct=True),
            _avg_rating=Avg('reviews__rating'),
        )

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  INTRODUCTION
# ══════════════════════════════════════════════════════════════

@admin.register(Introduction)
class IntroductionAdmin(admin.ModelAdmin):

    list_display   = ('course_link', 'title_display', 'video_preview',
                      'text_preview')
    list_filter    = ('course__category', 'course__is_published')
    search_fields  = ('title', 'text', 'course__title')
    ordering       = ('course__title',)
    list_per_page  = 25
    autocomplete_fields = ['course']

    fieldsets = (
        ('Введение', {
            'fields': ('course', 'title', 'text', 'video_url', 'video_preview_field'),
        }),
    )

    readonly_fields = ('video_preview_field',)

    @admin.display(description='Курс', ordering='course__title')
    def course_link(self, obj):
        url = reverse('admin:main_course_change', args=[obj.course.pk])
        return format_html('<a class="er-link" href="{}">{}</a>', url, obj.course.title)

    @admin.display(description='Заголовок', ordering='title')
    def title_display(self, obj):
        return format_html('<span class="er-title">{}</span>', obj.title)

    @admin.display(description='Видео')
    def video_preview(self, obj):
        return _video_link(obj.video_url)

    @admin.display(description='Предпросмотр видео')
    def video_preview_field(self, obj):
        if not obj.video_url:
            return format_html('<span class="er-text-faint">Ссылка не указана</span>')
        return format_html(
            '<div class="er-video-wrap">'
            '<a class="er-video-link er-video-link--big" href="{}" target="_blank" rel="noopener">'
            '<span class="er-video-icon-big">▶</span>'
            '<span>Открыть видео</span>'
            '</a>'
            '<p class="er-video-url">{}</p>'
            '</div>',
            obj.video_url, obj.video_url,
        )

    @admin.display(description='Текст')
    def text_preview(self, obj):
        preview = obj.text[:90] + ('…' if len(obj.text) > 90 else '')
        return format_html('<span class="er-stat">{}</span>', preview)

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  LESSON
# ══════════════════════════════════════════════════════════════

class LessonMaterialInlineFlat(admin.TabularInline):
    model               = LessonMaterial
    extra               = 0
    fields              = ('title', 'type', 'file', 'url')
    verbose_name        = 'Материал'
    verbose_name_plural = 'Материалы'


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):

    inlines       = [LessonMaterialInlineFlat]
    list_display  = ('order_num', 'title_display', 'course_link',
                     'duration_fmt', 'video_preview', 'materials_count',
                     'text_preview')
    list_display_links = ('order_num', 'title_display')
    list_filter   = ('course__category', 'course__is_published', 'course')
    search_fields = ('title', 'text', 'course__title')
    ordering      = ('course', 'order')
    list_per_page = 30
    autocomplete_fields = ['course']
    list_select_related = ('course',)
    show_full_result_count = False

    fieldsets = (
        ('Основное', {'fields': ('course', 'title', 'order', 'duration')}),
        ('Контент',  {'fields': ('video_url', 'video_preview_field', 'text')}),
    )

    readonly_fields = ('video_preview_field',)

    @admin.display(description='Название', ordering='title')
    def title_display(self, obj):
        return format_html('<span class="er-title">{}</span>', obj.title)

    @admin.display(description='Курс', ordering='course__title')
    def course_link(self, obj):
        url = reverse('admin:main_course_change', args=[obj.course.pk])
        return format_html('<a class="er-link" href="{}">{}</a>', url, obj.course.title)

    @admin.display(description='№', ordering='order')
    def order_num(self, obj):
        return format_html('<span class="er-num--order">#{}</span>', obj.order)

    @admin.display(description='Длит.', ordering='duration')
    def duration_fmt(self, obj):
        if obj.duration:
            return format_html('<span class="er-date">⏱ {} мин</span>', obj.duration)
        return format_html('<span class="er-text-faint">—</span>')

    @admin.display(description='Видео')
    def video_preview(self, obj):
        return _video_link(obj.video_url)

    @admin.display(description='Предпросмотр видео')
    def video_preview_field(self, obj):
        if not obj.video_url:
            return format_html('<span class="er-text-faint">Ссылка не указана</span>')
        return format_html(
            '<div class="er-video-wrap">'
            '<a class="er-video-link er-video-link--big" href="{}" target="_blank" rel="noopener">'
            '<span class="er-video-icon-big">▶</span>'
            '<span>Открыть видео</span>'
            '</a>'
            '<p class="er-video-url">{}</p>'
            '</div>',
            obj.video_url, obj.video_url,
        )

    @admin.display(description='Матер.')
    def materials_count(self, obj):
        count = obj._materials_count
        if count:
            return format_html('<span class="er-num">📎 {}</span>', count)
        return format_html('<span class="er-text-faint">0</span>')

    @admin.display(description='Текст')
    def text_preview(self, obj):
        if not obj.text:
            return format_html('<span class="er-text-faint">—</span>')
        preview = obj.text[:60] + ('…' if len(obj.text) > 60 else '')
        return format_html('<span class="er-stat">{}</span>', preview)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('course').annotate(
            _materials_count=Count('materials', distinct=True),
        )

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  LESSON MATERIAL
# ══════════════════════════════════════════════════════════════

@admin.register(LessonMaterial)
class LessonMaterialAdmin(admin.ModelAdmin):

    list_display   = ('title_display', 'lesson_link', 'course_link',
                      'type_badge', 'file_or_url')
    list_display_links = ('title_display',)
    list_filter    = ('type', 'lesson__course__category', 'lesson__course')
    search_fields  = ('title', 'lesson__title', 'lesson__course__title', 'url')
    ordering       = ('lesson__course', 'lesson__order', 'title')
    list_per_page  = 30
    autocomplete_fields = ['lesson']
    list_select_related = ('lesson', 'lesson__course')

    fieldsets = (
        ('Материал', {
            'fields': ('lesson', 'title', 'type', 'file', 'url'),
        }),
    )

    @admin.display(description='Название', ordering='title')
    def title_display(self, obj):
        return format_html('<span class="er-title">{}</span>', obj.title)

    @admin.display(description='Урок', ordering='lesson__title')
    def lesson_link(self, obj):
        url = reverse('admin:main_lesson_change', args=[obj.lesson.pk])
        return format_html(
            '<a class="er-link" href="{}">'
            '<span class="er-num--order" style="margin-right:5px;">#{}</span>{}'
            '</a>',
            url, obj.lesson.order, obj.lesson.title,
        )

    @admin.display(description='Курс', ordering='lesson__course__title')
    def course_link(self, obj):
        url = reverse('admin:main_course_change', args=[obj.lesson.course.pk])
        return format_html(
            '<a class="er-link" href="{}">{}</a>',
            url, obj.lesson.course.title,
        )

    @admin.display(description='Тип', ordering='type')
    def type_badge(self, obj):
        styles = {
            'pdf':  ('rgba(248,113,113,0.15)', '#fca5a5'),
            'link': ('rgba(14,165,233,0.15)',  '#7dd3fc'),
            'file': ('rgba(74,222,128,0.15)',  '#86efac'),
        }
        bg, color = styles.get(obj.type, ('#333', '#ccc'))
        return _badge(obj.get_type_display(), bg, color)

    @admin.display(description='Файл / Ссылка')
    def file_or_url(self, obj):
        if obj.file:
            return format_html(
                '<a class="er-link er-link--icon" href="{}" target="_blank">📄 Скачать</a>',
                obj.file.url,
            )
        if obj.url:
            return format_html(
                '<a class="er-link er-link--icon" href="{}" target="_blank">🔗 Открыть</a>',
                obj.url,
            )
        return format_html('<span class="er-text-faint">—</span>')

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  ENROLLMENT
# ══════════════════════════════════════════════════════════════

class LessonProgressInline(admin.TabularInline):
    model           = LessonProgress
    extra           = 0
    can_delete      = False
    readonly_fields = ('lesson_link_inline', 'done_status_inline', 'done_at_fmt')
    fields          = ('lesson_link_inline', 'done_status_inline', 'done_at_fmt')
    verbose_name        = 'Прогресс по уроку'
    verbose_name_plural = 'Прогресс по урокам'
    ordering = ('lesson__order',)

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Урок')
    def lesson_link_inline(self, obj):
        url = reverse('admin:main_lesson_change', args=[obj.lesson.pk])
        return format_html(
            '<a class="er-link" href="{}">'
            '<span class="er-num--order" style="margin-right:5px;">#{}</span>{}'
            '</a>',
            url, obj.lesson.order, obj.lesson.title,
        )

    @admin.display(description='Статус')
    def done_status_inline(self, obj):
        if obj.is_done:
            return format_html('<span class="er-status er-status--done">✓ Пройден</span>')
        return format_html('<span class="er-status er-status--off">○ Не пройден</span>')

    @admin.display(description='Дата прохождения')
    def done_at_fmt(self, obj):
        if obj.done_at:
            return format_html(
                '<span class="er-date">{}</span>',
                obj.done_at.strftime('%d.%m.%Y %H:%M'),
            )
        return format_html('<span class="er-text-faint">—</span>')


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):

    inlines       = [LessonProgressInline]
    actions       = [_action_mark_enrollments_complete, _action_reset_enrollment_progress]

    list_display  = ('student_link', 'course_link', 'progress_bar_display',
                     'lessons_done_display', 'completion_status',
                     'enrolled_at_fmt', 'last_accessed_fmt')
    list_display_links = ('student_link',)
    list_filter   = ('is_completed', 'course__category', 'enrolled_at')
    search_fields = ('student__email', 'student__first_name', 'student__last_name',
                     'course__title')
    ordering      = ('-last_accessed', '-enrolled_at')
    list_per_page = 30
    date_hierarchy = 'enrolled_at'
    autocomplete_fields = ['student', 'course']
    list_select_related = ('student', 'course')
    show_full_result_count = False

    readonly_fields = ('enrolled_at', 'last_accessed', 'completed_at',
                       'progress_readonly', 'lessons_done_readonly',
                       'course_stats_readonly')

    fieldsets = (
        ('Запись', {
            'fields': ('student', 'course', 'course_stats_readonly'),
        }),
        ('Прогресс', {
            'fields': ('progress_readonly', 'lessons_done_readonly',
                       'is_completed', 'completed_at'),
        }),
        ('Даты', {
            'fields': ('enrolled_at', 'last_accessed'),
            'classes': ('collapse',),
        }),
    )

    # ── display-методы ──────────────────────────────────────

    @admin.display(description='Студент', ordering='student__first_name')
    def student_link(self, obj):
        url  = reverse('admin:main_user_change', args=[obj.student.pk])
        name = obj.student.get_full_name() or obj.student.email
        return format_html('<a class="er-link" href="{}">{}</a>', url, name)

    @admin.display(description='Курс', ordering='course__title')
    def course_link(self, obj):
        url = reverse('admin:main_course_change', args=[obj.course.pk])
        return format_html('<a class="er-link" href="{}">{}</a>', url, obj.course.title)

    @admin.display(description='Прогресс')
    def progress_bar_display(self, obj):
        return _progress_bar(obj.progress)

    @admin.display(description='Уроков')
    def lessons_done_display(self, obj):
        total = obj.course.lessons.count()
        done  = obj.lessons_done
        color = '#4ade80' if done == total and total > 0 else '#c9a84c'
        return format_html(
            '<span class="er-stat" style="color:{};">{} / {}</span>',
            color, done, total,
        )

    @admin.display(description='Статус', ordering='is_completed')
    def completion_status(self, obj):
        if obj.is_completed:
            return format_html('<span class="er-status er-status--done">✓ Завершён</span>')
        if obj.progress > 0:
            return format_html('<span class="er-status er-status--progress">⟳ В процессе</span>')
        return format_html('<span class="er-status er-status--off">○ Не начат</span>')

    @admin.display(description='Записан', ordering='enrolled_at')
    def enrolled_at_fmt(self, obj):
        return format_html(
            '<span class="er-date">{}</span>',
            obj.enrolled_at.strftime('%d.%m.%Y'),
        )

    @admin.display(description='Последний визит', ordering='last_accessed')
    def last_accessed_fmt(self, obj):
        if not obj.last_accessed:
            return format_html('<span class="er-text-faint">—</span>')
        delta = timezone.now() - obj.last_accessed
        if delta.days == 0:
            return format_html('<span class="er-date er-date--fresh">Сегодня</span>')
        if delta.days == 1:
            return format_html('<span class="er-date">Вчера</span>')
        return format_html('<span class="er-date">{} дн. назад</span>', delta.days)

    @admin.display(description='Прогресс (%)')
    def progress_readonly(self, obj):
        return _progress_bar(obj.progress, f'{obj.progress}%')

    @admin.display(description='Пройдено уроков')
    def lessons_done_readonly(self, obj):
        total = obj.course.lessons.count()
        done  = obj.lessons_done
        return format_html('<strong>{}</strong> из <strong>{}</strong>', done, total)

    @admin.display(description='О курсе')
    def course_stats_readonly(self, obj):
        course = obj.course
        url    = reverse('admin:main_course_change', args=[course.pk])
        total  = course.lessons.count()
        dur    = course.lessons.aggregate(s=Sum('duration'))['s'] or 0
        cat    = course.get_category_display()
        lvl    = course.get_level_display()
        return format_html(
            '<div class="er-info-block">'
            '<a class="er-link" href="{url}" style="font-size:14px;font-weight:600;">{title}</a>'
            '<div class="er-info-row"><span class="er-text-faint">Категория:</span> {cat}</div>'
            '<div class="er-info-row"><span class="er-text-faint">Уровень:</span> {lvl}</div>'
            '<div class="er-info-row"><span class="er-text-faint">Уроков:</span> {total} ({dur} мин)</div>'
            '</div>',
            url=url, title=course.title, cat=cat, lvl=lvl, total=total, dur=dur,
        )

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  LESSON PROGRESS
# ══════════════════════════════════════════════════════════════

@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):

    actions       = [_action_mark_lessons_done, _action_mark_lessons_undone]

    list_display  = ('student_display', 'lesson_display', 'course_display',
                     'done_status', 'done_at_fmt')
    list_display_links = ('student_display',)
    list_filter   = ('is_done', 'lesson__course__category', 'enrollment__course')
    search_fields = ('enrollment__student__email', 'enrollment__student__first_name',
                     'lesson__title', 'enrollment__course__title')
    ordering      = ('-done_at', 'enrollment__student__first_name')
    list_per_page = 40
    autocomplete_fields = ['enrollment', 'lesson']
    readonly_fields     = ('done_at',)
    list_select_related = ('enrollment__student', 'lesson__course')
    show_full_result_count = False

    fieldsets = (
        ('Прогресс', {
            'fields': ('enrollment', 'lesson', 'is_done', 'done_at'),
        }),
    )

    @admin.display(description='Студент', ordering='enrollment__student__first_name')
    def student_display(self, obj):
        url  = reverse('admin:main_user_change', args=[obj.enrollment.student.pk])
        name = obj.enrollment.student.get_full_name() or obj.enrollment.student.email
        return format_html('<a class="er-link" href="{}">{}</a>', url, name)

    @admin.display(description='Урок', ordering='lesson__title')
    def lesson_display(self, obj):
        url = reverse('admin:main_lesson_change', args=[obj.lesson.pk])
        return format_html(
            '<a class="er-link" href="{}">'
            '<span class="er-num--order" style="margin-right:6px;">#{}</span>{}'
            '</a>',
            url, obj.lesson.order, obj.lesson.title,
        )

    @admin.display(description='Курс', ordering='lesson__course__title')
    def course_display(self, obj):
        url = reverse('admin:main_course_change', args=[obj.lesson.course.pk])
        return format_html('<a class="er-link" href="{}">{}</a>', url, obj.lesson.course.title)

    @admin.display(description='Статус', ordering='is_done')
    def done_status(self, obj):
        if obj.is_done:
            return format_html('<span class="er-status er-status--done">✓ Пройден</span>')
        return format_html('<span class="er-status er-status--off">○ Не пройден</span>')

    @admin.display(description='Дата прохождения', ordering='done_at')
    def done_at_fmt(self, obj):
        if obj.done_at:
            return format_html(
                '<span class="er-date">{}</span>',
                obj.done_at.strftime('%d.%m.%Y %H:%M'),
            )
        return format_html('<span class="er-text-faint">—</span>')

    class Media:
        css = ADMIN_CSS


# ══════════════════════════════════════════════════════════════
#  REVIEW
# ══════════════════════════════════════════════════════════════

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):

    list_display   = ('student_link', 'course_link', 'rating_stars',
                      'text_preview', 'created_at_fmt', 'updated_indicator')
    list_display_links = ('student_link',)
    list_filter    = ('rating', 'course__category', 'created_at')
    search_fields  = ('student__email', 'student__first_name', 'student__last_name',
                      'course__title', 'text')
    ordering       = ('-created_at',)
    list_per_page  = 30
    date_hierarchy = 'created_at'
    list_select_related = ('student', 'course')
    show_full_result_count = False

    readonly_fields = ('student', 'course', 'created_at', 'updated_at',
                       'rating_stars_readonly', 'enrollment_info')

    fieldsets = (
        ('Отзыв', {
            'fields': ('student', 'course', 'enrollment_info',
                       'rating_stars_readonly', 'rating', 'text'),
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        """Отзывы создаются только студентами через сайт."""
        return False

    @admin.display(description='Студент', ordering='student__first_name')
    def student_link(self, obj):
        url  = reverse('admin:main_user_change', args=[obj.student.pk])
        name = obj.student.get_full_name() or obj.student.email
        return format_html('<a class="er-link" href="{}">{}</a>', url, name)

    @admin.display(description='Курс', ordering='course__title')
    def course_link(self, obj):
        url = reverse('admin:main_course_change', args=[obj.course.pk])
        return format_html('<a class="er-link" href="{}">{}</a>', url, obj.course.title)

    @admin.display(description='Оценка', ordering='rating')
    def rating_stars(self, obj):
        return _stars(obj.rating)

    @admin.display(description='Оценка (подробно)')
    def rating_stars_readonly(self, obj):
        return format_html(
            '<div style="display:flex;align-items:center;gap:10px;">'
            '{}'
            '<span class="er-num" style="font-size:18px;">{}/5</span>'
            '</div>',
            _stars(obj.rating), obj.rating,
        )

    @admin.display(description='Текст отзыва')
    def text_preview(self, obj):
        if not obj.text:
            return format_html('<span class="er-text-faint">—</span>')
        preview = obj.text[:80] + ('…' if len(obj.text) > 80 else '')
        return format_html('<span class="er-stat">{}</span>', preview)

    @admin.display(description='Дата', ordering='created_at')
    def created_at_fmt(self, obj):
        return format_html(
            '<span class="er-date">{}</span>',
            obj.created_at.strftime('%d.%m.%Y'),
        )

    @admin.display(description='Изм.')
    def updated_indicator(self, obj):
        if obj.updated_at and obj.updated_at.date() != obj.created_at.date():
            return format_html(
                '<span class="er-badge" style="background:rgba(251,191,36,0.15);color:#fcd34d;">'
                '✏ изм.'
                '</span>',
            )
        return format_html('<span class="er-text-faint">—</span>')

    @admin.display(description='Запись на курс')
    def enrollment_info(self, obj):
        try:
            enrollment = Enrollment.objects.get(student=obj.student, course=obj.course)
            url = reverse('admin:main_enrollment_change', args=[enrollment.pk])
            return format_html(
                '<div class="er-info-block">'
                '<div class="er-info-row">'
                '<span class="er-text-faint">Прогресс:</span> {}'
                '</div>'
                '<div class="er-info-row">'
                '<span class="er-text-faint">Статус:</span> {}'
                '</div>'
                '<a class="er-link" href="{}" style="font-size:11px;">→ Перейти к записи</a>'
                '</div>',
                _progress_bar(enrollment.progress),
                '✓ Завершён' if enrollment.is_completed else '⟳ В процессе',
                url,
            )
        except Enrollment.DoesNotExist:
            return format_html('<span class="er-text-faint">Запись не найдена</span>')

    class Media:
        css = ADMIN_CSS
