import json
import re
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.http import JsonResponse
from django.db.models import Max, Q, Sum, Count, Avg
from django.db.models.functions import Coalesce
from django.db.models import Value
from .forms import RegisterForm
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.http import require_POST
from .models import Course, Introduction, Lesson, LessonMaterial, Enrollment, LessonProgress, Review

# ══════════════════════════════════════════════════
# ГЛАВНАЯ
# ══════════════════════════════════════════════════

def mainPage(request):
    def _top_per_category(category, limit=2):
        return list(
            Course.objects
            .filter(is_published=True, category=category)
            .select_related('teacher')
            .prefetch_related('lessons', 'enrollments')
            .annotate(
                enrollments_count=Count('enrollments', distinct=True),
                avg_rating=Coalesce(Avg('reviews__rating'), Value(0.0)),
                reviews_count=Count('reviews', distinct=True),
            )
            .order_by('-avg_rating', '-enrollments_count', '-created_at')[:limit]
        )

    featured_courses = []
    for cat in [Course.Category.DEV, Course.Category.DESIGN, Course.Category.DATA]:
        featured_courses.extend(_top_per_category(cat, 2))

    featured_courses.sort(
        key=lambda c: (float(c.avg_rating), c.enrollments_count),
        reverse=True,
    )
    featured_courses = featured_courses[:6]

    enrolled_ids = set()
    if request.user.is_authenticated and request.user.is_student:
        enrolled_ids = set(
            Enrollment.objects
            .filter(student=request.user)
            .values_list('course_id', flat=True)
        )

    return render(request, 'main/main_page.html', {
        'featured_courses': featured_courses,
        'enrolled_ids': enrolled_ids,
    })


# ══════════════════════════════════════════════════
# ЛИЧНЫЙ КАБИНЕТ СТУДЕНТА
# ══════════════════════════════════════════════════

@login_required
def student_dashboard(request):
    if not request.user.is_student:
        return redirect('teacher_courses')

    enrollments = (
        Enrollment.objects
        .filter(student=request.user)
        .select_related('course', 'course__teacher')
        .prefetch_related('course__lessons', 'lesson_progresses')
    )

    active_enrollments    = [e for e in enrollments if not e.is_completed]
    completed_enrollments = [e for e in enrollments if e.is_completed]

    total_enrolled     = enrollments.count()
    total_completed    = len(completed_enrollments)
    total_lessons_done = sum(e.lessons_done for e in enrollments)
    avg_progress       = round(sum(e.progress for e in enrollments) / total_enrolled) if total_enrolled else 0

    enrolled_ids = enrollments.values_list('course_id', flat=True)
    recommended_courses = (
        Course.objects
        .filter(is_published=True)
        .exclude(id__in=enrolled_ids)
        .order_by('-created_at')[:3]
    )

    for e in active_enrollments:
        all_lesson_ids = list(e.course.lessons.values_list('pk', flat=True).order_by('order'))
        done_ids = set(e.lesson_progresses.filter(is_done=True).values_list('lesson_id', flat=True))
        e.next_lesson_id = next((lid for lid in all_lesson_ids if lid not in done_ids), all_lesson_ids[0] if all_lesson_ids else None)

    reviews_by_course = {
        r.course_id: r
        for r in Review.objects.filter(student=request.user)
    }
    for e in completed_enrollments:
        e.review = reviews_by_course.get(e.course_id)

    return render(request, 'main/student_dashboard.html', {
        'active_enrollments':    active_enrollments,
        'completed_enrollments': completed_enrollments,
        'total_enrolled':        total_enrolled,
        'total_completed':       total_completed,
        'total_lessons_done':    total_lessons_done,
        'avg_progress':          avg_progress,
        'recommended_courses':   recommended_courses,
    })


@login_required
@require_POST
def student_unenroll(request, enrollment_id):
    if not request.user.is_student:
        return redirect('home')

    enrollment   = get_object_or_404(Enrollment, pk=enrollment_id, student=request.user)
    course_title = enrollment.course.title
    enrollment.delete()
    messages.success(request, f'Ты отписался от курса «{course_title}».')
    return redirect('student_dashboard')


@login_required
@require_POST
def student_enroll(request, course_id):
    if not request.user.is_student:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, is_published=True)
    enrollment, created = Enrollment.objects.get_or_create(student=request.user, course=course)

    if created:
        enrollment.mark_accessed()
        return JsonResponse({'success': True, 'message': f'Ты записан на курс «{course.title}»!'})
    return JsonResponse({'success': False, 'message': 'Ты уже записан на этот курс.'})


@login_required
@require_POST
def mark_lesson_done(request, course_id, lesson_id):
    if not request.user.is_student:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course     = get_object_or_404(Course, pk=course_id)
    lesson     = get_object_or_404(Lesson, pk=lesson_id, course=course)
    enrollment = get_object_or_404(Enrollment, student=request.user, course=course)

    progress, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    progress.mark_done()
    enrollment.mark_accessed()

    return JsonResponse({
        'success':      True,
        'progress':     enrollment.progress,
        'lessons_done': enrollment.lessons_done,
        'completed':    enrollment.is_completed,
    })


# ══════════════════════════════════════════════════
# КУРСЫ ПРЕПОДАВАТЕЛЯ
# ══════════════════════════════════════════════════

@login_required
def teacher_courses(request):
    if not request.user.is_teacher:
        return redirect('home')

    courses = list(
        Course.objects
        .filter(teacher=request.user)
        .prefetch_related('lessons')
        .annotate(
            avg_rating=Coalesce(Avg('reviews__rating'), Value(0.0)),
            reviews_count=Count('reviews', distinct=True),
        )
        .order_by('-created_at')
    )

    # Рейтинговое распределение по каждому курсу (один доп. запрос вместо N)
    from collections import defaultdict
    raw = (
        Review.objects
        .filter(course__teacher=request.user)
        .values('course_id', 'rating')
    )
    dist_map = defaultdict(lambda: defaultdict(int))
    for row in raw:
        dist_map[row['course_id']][row['rating']] += 1

    for course in courses:
        bucket = dist_map[course.pk]
        total  = course.reviews_count or 1
        course.rating_dist = [
            {
                'stars': i,
                'count': bucket[i],
                'pct':   round(bucket[i] / total * 100),
            }
            for i in range(5, 0, -1)
        ]

    # Последние отзывы по всем курсам преподавателя
    recent_reviews = (
        Review.objects
        .filter(course__teacher=request.user)
        .select_related('student', 'course')
        .order_by('-created_at')[:8]
    )

    total_reviews      = Review.objects.filter(course__teacher=request.user).count()
    overall_avg_raw    = Review.objects.filter(course__teacher=request.user).aggregate(avg=Avg('rating'))['avg'] or 0
    overall_avg_rating = round(float(overall_avg_raw), 1)

    return render(request, 'main/teacher_courses.html', {
        'courses':             courses,
        'total_students':      Enrollment.objects.filter(course__teacher=request.user).count(),
        'published_count':     sum(1 for c in courses if c.is_published),
        'recent_reviews':      recent_reviews,
        'total_reviews':       total_reviews,
        'overall_avg_rating':  overall_avg_rating,
    })


@login_required
def teacher_course_edit(request, course_id):
    if not request.user.is_teacher:
        return redirect('home')

    course       = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lessons      = course.lessons.prefetch_related('materials').order_by('order')
    first_lesson = lessons.first()

    return render(request, 'main/teacher_course_edit.html', {
        'course':          course,
        'lessons':         lessons,
        'first_lesson_id': first_lesson.pk if first_lesson else None,
    })


# ══════════════════════════════════════════════════
# CRUD КУРСА
# ══════════════════════════════════════════════════

@login_required
def create_course(request):
    if not request.user.is_teacher:
        return redirect('home')

    if request.method != 'POST':
        return redirect('teacher_courses')

    title        = request.POST.get('title', '').strip()
    description  = request.POST.get('description', '').strip()
    category     = request.POST.get('category', '')
    level        = request.POST.get('level', 'beginner')
    is_published = request.POST.get('is_published') == 'on'
    thumbnail    = request.FILES.get('thumbnail')

    if not title or not description or not category:
        return JsonResponse({'error': 'Заполните все обязательные поля'}, status=400)

    course = Course.objects.create(
        title=title, description=description, category=category,
        level=level, teacher=request.user,
        is_published=is_published, thumbnail=thumbnail,
    )

    intro_title = request.POST.get('intro_title', '').strip()
    intro_text  = request.POST.get('intro_text', '').strip()
    intro_video = request.POST.get('intro_video', '').strip()

    if intro_text:
        Introduction.objects.create(
            course=course,
            title=intro_title or 'Введение в курс',
            text=intro_text,
            video_url=intro_video,
        )

    return JsonResponse({'success': True, 'redirect': f'/teacher/courses/{course.pk}/edit/'})


@login_required
@require_POST
def delete_course(request, course_id):
    if not request.user.is_teacher:
        return redirect('home')

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    title  = course.title
    course.delete()
    messages.success(request, f'Курс «{title}» удалён.')
    return redirect('teacher_courses')


@login_required
@require_POST
def toggle_publish_course(request, course_id):
    if not request.user.is_teacher:
        return redirect('home')

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    course.is_published = not course.is_published
    course.save(update_fields=['is_published'])
    return redirect('teacher_course_edit', course_id=course_id)


# ══════════════════════════════════════════════════
# ХЕЛПЕРЫ СЕРИАЛИЗАЦИИ
# ══════════════════════════════════════════════════

def _lesson_full(lesson):
    return {
        'id': lesson.pk, 'title': lesson.title, 'order': lesson.order,
        'duration': lesson.duration, 'video_url': lesson.video_url, 'text': lesson.text,
        'materials': [
            {'id': m.pk, 'title': m.title, 'type': m.type, 'url': m.url,
             'file': m.file.url if m.file else ''}
            for m in lesson.materials.all()
        ],
    }


def _lesson_sidebar(lesson):
    return {
        'id': lesson.pk, 'title': lesson.title, 'order': lesson.order,
        'duration': lesson.duration, 'video_url': lesson.video_url,
        'materials_count': lesson.materials.count(),
    }


# ══════════════════════════════════════════════════
# AJAX: УРОКИ
# ══════════════════════════════════════════════════

@login_required
def get_lesson(request, course_id, lesson_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lesson = get_object_or_404(Lesson, pk=lesson_id, course=course)
    return JsonResponse(_lesson_full(lesson))


@login_required
@require_POST
def create_lesson(request, course_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Неверный формат данных'}, status=400)

    title = data.get('title', '').strip()
    if not title:
        return JsonResponse({'error': 'Название урока обязательно'}, status=400)

    last_order = course.lessons.aggregate(max_order=Max('order'))['max_order'] or 0
    lesson     = Lesson.objects.create(course=course, title=title, order=last_order + 1)
    return JsonResponse(_lesson_full(lesson))


@login_required
@require_POST
def update_lesson(request, course_id, lesson_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lesson = get_object_or_404(Lesson, pk=lesson_id, course=course)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Неверный формат данных'}, status=400)

    title     = data.get('title', '').strip()
    order     = data.get('order', lesson.order)
    duration  = data.get('duration', 0)
    video_url = data.get('video_url', '').strip()
    text      = data.get('text', '')

    if not title:
        return JsonResponse({'error': 'Название урока обязательно'}, status=400)

    lesson.title     = title
    lesson.order     = int(order) if order else lesson.order
    lesson.duration  = int(duration) if duration else 0
    lesson.video_url = video_url
    lesson.text      = text
    lesson.save()

    return JsonResponse({'success': True, 'lesson': _lesson_sidebar(lesson)})


@login_required
@require_POST
def delete_lesson(request, course_id, lesson_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lesson = get_object_or_404(Lesson, pk=lesson_id, course=course)
    lesson.delete()

    next_lesson = course.lessons.order_by('order').first()
    return JsonResponse({'success': True, 'next_lesson_id': next_lesson.pk if next_lesson else None})


@login_required
@require_POST
def reorder_lessons(request, course_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)

    try:
        data       = json.loads(request.body)
        order_list = data.get('order', [])
    except (json.JSONDecodeError, KeyError):
        return JsonResponse({'error': 'Неверный формат данных'}, status=400)

    for item in order_list:
        Lesson.objects.filter(pk=item['id'], course=course).update(order=item['order'])

    return JsonResponse({'success': True})


# ══════════════════════════════════════════════════
# AJAX: МАТЕРИАЛЫ УРОКА
# ══════════════════════════════════════════════════

@login_required
@require_POST
def create_lesson_material(request, course_id, lesson_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lesson = get_object_or_404(Lesson, pk=lesson_id, course=course)
    content_type = request.content_type or ''

    if 'application/json' in content_type:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Неверный формат данных'}, status=400)

        title    = data.get('title', '').strip()
        mat_type = data.get('type', 'link')
        url      = data.get('url', '').strip()

        if not title:
            return JsonResponse({'error': 'Название обязательно'}, status=400)

        material = LessonMaterial.objects.create(lesson=lesson, title=title, type=mat_type, url=url)
        return JsonResponse({'id': material.pk, 'title': material.title, 'type': material.type, 'url': url, 'file': ''})
    else:
        title    = request.POST.get('title', '').strip()
        mat_type = request.POST.get('type', 'pdf')
        file     = request.FILES.get('file')

        if not title:
            return JsonResponse({'error': 'Название обязательно'}, status=400)

        material = LessonMaterial.objects.create(lesson=lesson, title=title, type=mat_type, file=file)
        return JsonResponse({
            'id': material.pk, 'title': material.title, 'type': material.type,
            'url': '', 'file': material.file.url if material.file else '',
        })


@login_required
@require_POST
def delete_lesson_material(request, course_id, lesson_id, material_id):
    if not request.user.is_teacher:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course   = get_object_or_404(Course, pk=course_id, teacher=request.user)
    lesson   = get_object_or_404(Lesson, pk=lesson_id, course=course)
    material = get_object_or_404(LessonMaterial, pk=material_id, lesson=lesson)
    material.delete()
    return JsonResponse({'success': True})


# ══════════════════════════════════════════════════
# АВТОРИЗАЦИЯ
# ══════════════════════════════════════════════════

def register_view(request):
    if request.method != 'POST':
        return redirect('home')

    form = RegisterForm(request.POST)
    if form.is_valid():
        user = form.save()
        login(request, user)
        return redirect('home')

    errors = {field: error[0] for field, error in form.errors.items()}
    return JsonResponse({'errors': errors}, status=400)


def login_view(request):
    if request.method != 'POST':
        return redirect('home')

    email    = request.POST.get('email', '').lower()
    password = request.POST.get('password', '')
    user     = authenticate(request, username=email, password=password)

    if user is not None:
        login(request, user)
        return redirect('teacher_courses' if user.is_teacher else 'student_dashboard')

    return JsonResponse({'error': 'Неверная почта или пароль'}, status=400)


def logout_view(request):
    logout(request)
    return redirect('home')


def courses_catalog(request):
    """Каталог всех опубликованных курсов с поиском и фильтрами."""

    courses = (
        Course.objects
        .filter(is_published=True)
        .select_related('teacher')
        .prefetch_related('lessons')
        .annotate(
            avg_rating=Coalesce(Avg('reviews__rating'), Value(0.0)),
            reviews_count=Count('reviews', distinct=True),
            enrollments_count=Count('enrollments', distinct=True),
            total_duration=Coalesce(Sum('lessons__duration'), Value(0)),
        )
    )

    search_query = request.GET.get('q', '').strip()
    if search_query:
        courses = courses.filter(
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(teacher__first_name__icontains=search_query) |
            Q(teacher__last_name__icontains=search_query)
        )

    active_category = request.GET.get('category', '')
    if active_category:
        courses = courses.filter(category=active_category)

    active_level = request.GET.get('level', '')
    if active_level:
        courses = courses.filter(level=active_level)

    sort = request.GET.get('sort', '-created_at')
    allowed_sorts = ['created_at', '-created_at', 'title', '-title', '-avg_rating']
    if sort in allowed_sorts:
        courses = courses.order_by(sort)
    else:
        courses = courses.order_by('-created_at')

    enrolled_ids = set()
    if request.user.is_authenticated and request.user.is_student:
        enrolled_ids = set(
            request.user.enrollments.values_list('course_id', flat=True)
        )

    context = {
        'courses': courses,
        'total_courses': Course.objects.filter(is_published=True).count(),
        'search_query': search_query,
        'active_category': active_category,
        'active_level': active_level,
        'sort': sort,
        'enrolled_ids': enrolled_ids,
    }
    return render(request, 'main/courses_catalog.html', context)


def course_detail(request, course_id):
    """Страница детального просмотра курса."""
    course = get_object_or_404(Course, pk=course_id, is_published=True)

    lessons = course.lessons.prefetch_related('materials').order_by('order')

    enrollment = None
    is_enrolled = False
    done_lesson_ids = set()

    if request.user.is_authenticated and request.user.is_student:
        enrollment = Enrollment.objects.filter(
            student=request.user, course=course
        ).prefetch_related('lesson_progresses').first()

        if enrollment:
            is_enrolled = True
            done_lesson_ids = set(
                enrollment.lesson_progresses
                .filter(is_done=True)
                .values_list('lesson_id', flat=True)
            )

    total_duration = lessons.aggregate(total=Sum('duration'))['total'] or 0

    teacher_courses_count = Course.objects.filter(
        teacher=course.teacher, is_published=True
    ).count()
    teacher_students_count = Enrollment.objects.filter(
        course__teacher=course.teacher
    ).count()

    related_courses = (
        Course.objects
        .filter(is_published=True, category=course.category)
        .exclude(pk=course.pk)
        .prefetch_related('lessons')
        .order_by('-created_at')[:3]
    )

    reviews = (
        Review.objects
        .filter(course=course)
        .select_related('student')
        .order_by('-created_at')
    )
    reviews_count = reviews.count()
    avg_rating    = float(reviews.aggregate(avg=Avg('rating'))['avg'] or 0)

    # Распределение оценок (5★ → 1★) с процентами
    rating_distribution = []
    for i in range(5, 0, -1):
        cnt = reviews.filter(rating=i).count()
        pct = round(cnt / reviews_count * 100) if reviews_count else 0
        rating_distribution.append({'stars': i, 'count': cnt, 'pct': pct})

    avg_rating_int = int(avg_rating)

    intro_embed_url = _to_embed_url(course.introduction.video_url) if hasattr(course, 'introduction') and course.introduction else ''

    # Первый непройденный урок для кнопки «Перейти к обучению»
    next_lesson_id = None
    if is_enrolled:
        lessons_list = list(lessons)
        next_lesson = next(
            (l for l in lessons_list if l.pk not in done_lesson_ids),
            lessons_list[0] if lessons_list else None,
        )
        if next_lesson:
            next_lesson_id = next_lesson.pk

    return render(request, 'main/course_detail.html', {
        'course':              course,
        'lessons':             lessons,
        'enrollment':          enrollment,
        'is_enrolled':         is_enrolled,
        'done_lesson_ids':     done_lesson_ids,
        'total_duration':      total_duration,
        'students_count':      course.enrollments.count(),
        'teacher_courses_count':   teacher_courses_count,
        'teacher_students_count':  teacher_students_count,
        'related_courses':     related_courses,
        'reviews':             reviews,
        'reviews_count':       reviews_count,
        'avg_rating':          avg_rating,
        'avg_rating_int':      avg_rating_int,
        'rating_distribution': rating_distribution,
        'intro_embed_url':    intro_embed_url,
        'next_lesson_id':     next_lesson_id,
    })


def _to_embed_url(url):
    """Конвертирует YouTube/Vimeo URL в embed-формат для iframe."""
    if not url:
        return ""
    import re
    yt = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    if yt:
        video_id = yt.group(1)
        return f"https://www.youtube-nocookie.com/embed/{video_id}?rel=0&modestbranding=1"
    vm = re.search(r"vimeo\.com/(\d+)", url)
    if vm:
        return f"https://player.vimeo.com/video/{vm.group(1)}"
    return url


@login_required
def course_learn(request, course_id, lesson_id):
    """Страница прохождения урока."""
    if not request.user.is_student:
        return redirect('home')

    course = get_object_or_404(Course, pk=course_id, is_published=True)
    enrollment = get_object_or_404(Enrollment, student=request.user, course=course)

    lessons = list(course.lessons.prefetch_related('materials').order_by('order'))
    total_lessons = len(lessons)
    total_duration = course.lessons.aggregate(total=Sum('duration'))['total'] or 0

    done_lesson_ids = set(
        enrollment.lesson_progresses
        .filter(is_done=True)
        .values_list('lesson_id', flat=True)
    )

    current_lesson = get_object_or_404(Lesson, pk=lesson_id, course=course)

    lesson_ids = [l.pk for l in lessons]
    current_idx = lesson_ids.index(current_lesson.pk)

    first_undone_idx = next(
        (i for i, lid in enumerate(lesson_ids) if lid not in done_lesson_ids),
        total_lessons
    )

    if current_idx > first_undone_idx:
        redirect_lesson_id = lesson_ids[first_undone_idx]
        return redirect('course_learn', course_id=course_id, lesson_id=redirect_lesson_id)

    prev_lesson = lessons[current_idx - 1] if current_idx > 0 else None
    next_lesson = lessons[current_idx + 1] if current_idx < total_lessons - 1 else None

    next_available_id = (
        lesson_ids[first_undone_idx + 1]
        if first_undone_idx + 1 < total_lessons
        else None
    )

    is_current_done = current_lesson.pk in done_lesson_ids

    enrollment.mark_accessed()

    user_review = None
    if enrollment.is_completed:
        user_review = Review.objects.filter(student=request.user, course=course).first()

    return render(request, 'main/course_learn.html', {
        'course': course,
        'enrollment': enrollment,
        'lessons': lessons,
        'current_lesson': current_lesson,
        'prev_lesson': prev_lesson,
        'next_lesson': next_lesson,
        'done_lesson_ids': done_lesson_ids,
        'is_current_done': is_current_done,
        'total_lessons': total_lessons,
        'total_duration': total_duration,
        'next_available_id': next_available_id,
        'embed_url': _to_embed_url(current_lesson.video_url),
        'user_review': user_review,
    })


# ══════════════════════════════════════════════════
# ОТЗЫВЫ
# ══════════════════════════════════════════════════

@login_required
@require_POST
def submit_review(request, course_id):
    """Принять отзыв от студента. Доступно только после полного прохождения курса."""
    if not request.user.is_student:
        return JsonResponse({'error': 'Нет доступа'}, status=403)

    course = get_object_or_404(Course, pk=course_id, is_published=True)
    enrollment = get_object_or_404(Enrollment, student=request.user, course=course)

    if not enrollment.is_completed:
        return JsonResponse({'error': 'Отзыв доступен только после полного прохождения курса'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Неверный формат данных'}, status=400)

    rating = data.get('rating')
    text   = data.get('text', '').strip()

    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Оценка должна быть от 1 до 5'}, status=400)

    review, created = Review.objects.update_or_create(
        student=request.user,
        course=course,
        defaults={'rating': rating, 'text': text},
    )

    return JsonResponse({
        'success': True,
        'created': created,
        'rating':  review.rating,
        'text':    review.text,
    })
