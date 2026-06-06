from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'student')
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'student', 'Студент'
        TEACHER = 'teacher', 'Преподаватель'

    username = None
    email    = models.EmailField(unique=True)
    role     = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.email})'

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    class Meta:
        verbose_name        = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering            = ['-date_joined']


class Course(models.Model):
    class Category(models.TextChoices):
        DEV    = 'dev',    'Разработка'
        DESIGN = 'design', 'Дизайн'
        DATA   = 'data',   'Аналитика'

    class Level(models.TextChoices):
        BEGINNER     = 'beginner',     'Начинающий'
        INTERMEDIATE = 'intermediate', 'Средний'
        ADVANCED     = 'advanced',     'Продвинутый'

    title        = models.CharField('Название', max_length=200)
    description  = models.TextField('Описание')
    category     = models.CharField('Категория', max_length=20, choices=Category.choices)
    level        = models.CharField('Уровень', max_length=20, choices=Level.choices, default=Level.BEGINNER)
    teacher      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='courses',
        verbose_name='Преподаватель',
        limit_choices_to={'role': 'teacher'},
    )
    thumbnail    = models.ImageField('Обложка', upload_to='courses/thumbnails/', blank=True)
    is_published = models.BooleanField('Опубликован', default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Курс'
        verbose_name_plural = 'Курсы'
        ordering            = ['-created_at']

    def __str__(self):
        return self.title


class Introduction(models.Model):
    course    = models.OneToOneField(Course, on_delete=models.CASCADE, related_name='introduction')
    title     = models.CharField('Заголовок', max_length=200, default='Введение в курс')
    text      = models.TextField('Текст ознакомления')
    video_url = models.URLField('Ссылка на видео', blank=True)

    class Meta:
        verbose_name        = 'Введение'
        verbose_name_plural = 'Введения'

    def __str__(self):
        return f'Введение: {self.course.title}'


class Lesson(models.Model):
    course    = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons')
    title     = models.CharField('Название урока', max_length=200)
    order     = models.PositiveIntegerField('Порядок', default=0)
    video_url = models.URLField('Ссылка на видео', blank=True)
    text      = models.TextField('Текстовый материал', blank=True)
    duration  = models.PositiveIntegerField('Длительность (мин)', default=0)

    class Meta:
        verbose_name        = 'Урок'
        verbose_name_plural = 'Уроки'
        ordering            = ['order']

    def __str__(self):
        return f'{self.course.title} — Урок {self.order}: {self.title}'


class LessonMaterial(models.Model):
    class MaterialType(models.TextChoices):
        PDF  = 'pdf',  'PDF файл'
        LINK = 'link', 'Ссылка'
        FILE = 'file', 'Файл'

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='materials')
    title  = models.CharField('Название', max_length=200)
    type   = models.CharField('Тип', max_length=10, choices=MaterialType.choices)
    file   = models.FileField('Файл', upload_to='courses/materials/', blank=True)
    url    = models.URLField('Ссылка', blank=True)

    class Meta:
        verbose_name        = 'Материал'
        verbose_name_plural = 'Материалы'

    def __str__(self):
        return f'{self.lesson.title} — {self.title}'


# ══════════════════════════════════════════════════
# МОДЕЛЬ ЗАПИСИ НА КУРС
# ══════════════════════════════════════════════════

class Enrollment(models.Model):
    """Запись студента на курс с отслеживанием прогресса."""

    student       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments',
        verbose_name='Студент',
        limit_choices_to={'role': 'student'},
    )
    course        = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments',
        verbose_name='Курс',
    )
    enrolled_at   = models.DateTimeField('Дата записи', auto_now_add=True)
    last_accessed = models.DateTimeField('Последний визит', null=True, blank=True)
    is_completed  = models.BooleanField('Завершён', default=False)
    completed_at  = models.DateTimeField('Дата завершения', null=True, blank=True)

    class Meta:
        verbose_name        = 'Запись на курс'
        verbose_name_plural = 'Записи на курсы'
        unique_together     = ('student', 'course')
        ordering            = ['-last_accessed', '-enrolled_at']

    def __str__(self):
        return f'{self.student} → {self.course.title}'

    @property
    def lessons_done(self):
        """Количество пройденных уроков."""
        return self.lesson_progresses.filter(is_done=True).count()

    @property
    def progress(self):
        """Процент прохождения курса (0–100)."""
        total = self.course.lessons.count()
        if not total:
            return 0
        return round(self.lessons_done / total * 100)

    def mark_accessed(self):
        """Обновить время последнего визита."""
        self.last_accessed = timezone.now()
        self.save(update_fields=['last_accessed'])

    def check_completion(self):
        """Пометить курс завершённым если все уроки пройдены."""
        if self.progress == 100 and not self.is_completed:
            self.is_completed  = True
            self.completed_at  = timezone.now()
            self.save(update_fields=['is_completed', 'completed_at'])


class LessonProgress(models.Model):
    """Прогресс студента по отдельному уроку."""

    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='lesson_progresses')
    lesson     = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progresses')
    is_done    = models.BooleanField('Пройден', default=False)
    done_at    = models.DateTimeField('Дата прохождения', null=True, blank=True)

    class Meta:
        verbose_name        = 'Прогресс по уроку'
        verbose_name_plural = 'Прогрессы по урокам'
        unique_together     = ('enrollment', 'lesson')

    def __str__(self):
        status = '✓' if self.is_done else '○'
        return f'{status} {self.enrollment.student} — {self.lesson.title}'

    def mark_done(self):
        if not self.is_done:
            self.is_done = True
            self.done_at = timezone.now()
            self.save(update_fields=['is_done', 'done_at'])
            self.enrollment.check_completion()


# ══════════════════════════════════════════════════
# МОДЕЛЬ ОТЗЫВА О КУРСЕ
# ══════════════════════════════════════════════════

class Review(models.Model):
    """Отзыв студента о курсе. Только после полного прохождения."""

    student    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name='Студент',
        limit_choices_to={'role': 'student'},
    )
    course     = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name='Курс',
    )
    rating     = models.PositiveSmallIntegerField(
        'Оценка',
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    text       = models.TextField('Текст отзыва', blank=True)
    created_at = models.DateTimeField('Дата отзыва', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)

    class Meta:
        verbose_name        = 'Отзыв'
        verbose_name_plural = 'Отзывы'
        unique_together     = ('student', 'course')   # один отзыв на курс
        ordering            = ['-created_at']

    def __str__(self):
        return f'{self.student} → {self.course.title} ({self.rating}★)'

    @property
    def stars_range(self):
        """Вспомогательное свойство для шаблонов: range(1, 6)."""
        return range(1, 6)
