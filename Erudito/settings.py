"""
Django settings for Erudito project.
"""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-3a7v(#db*(q$vor(4pl7-&8oo8^rz8vfjv9fs2_ok5jf#o%&^*')

DEBUG = False

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


INSTALLED_APPS = [
    'jazzmin',
    'nested_admin',
    'main',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

# ══════════════════════════════════════════════════════════════
#  JAZZMIN — настройки кастомной админки
# ══════════════════════════════════════════════════════════════

JAZZMIN_SETTINGS = {
    # ── Шапка и бренд ───────────────────────────────────────
    "site_title":        "Erudito Admin",
    "site_header":       "Erudito",
    "site_brand":        "Erudito",
    "welcome_sign":      "Добро пожаловать в панель управления",
    "copyright":         "Erudito © 2025",

    # ── Иконки для приложений и моделей ─────────────────────
    # Формат: "app_label.ModelName" (строчными)
    "icons": {
        # Django
        "auth":                    "fas fa-shield-alt",
        "auth.group":              "fas fa-layer-group",

        # Erudito — приложение main
        "main":                    "fas fa-graduation-cap",
        "main.user":               "fas fa-user-graduate",
        "main.course":             "fas fa-book-open",
        "main.introduction":       "fas fa-info-circle",
        "main.lesson":             "fas fa-play-circle",
        "main.lessonmaterial":     "fas fa-paperclip",
        "main.enrollment":         "fas fa-user-check",
        "main.lessonprogress":     "fas fa-tasks",
        "main.review":             "fas fa-star",
    },
    "default_icon_parents":  "fas fa-folder",
    "default_icon_children": "fas fa-circle",

    # ── Боковая панель ───────────────────────────────────────
    "show_sidebar":         True,
    "navigation_expanded":  True,

    # Порядок моделей в сайдбаре (по логике платформы)
    "order_with_respect_to": [
        "main.user",
        "main.course",
        "main.introduction",
        "main.lesson",
        "main.lessonmaterial",
        "main.enrollment",
        "main.lessonprogress",
        "main.review",
        "auth",
    ],

    # ── Верхнее меню ────────────────────────────────────────
    "topmenu_links": [
        {"name": "На сайт",  "url": "/",         "new_window": False, "icon": "fas fa-home"},
        {"name": "Каталог",  "url": "/courses/",  "new_window": False, "icon": "fas fa-book"},
        {"model": "main.user"},
    ],

    # ── Кастомные ссылки в сайдбаре ─────────────────────────
    "custom_links": {
        "main": [
            {
                "name":        "Открыть сайт",
                "url":         "/",
                "icon":        "fas fa-external-link-alt",
                "permissions": ["main.view_course"],
            },
        ],
    },

    # ── Глобальный Quick Search ──────────────────────────────
    "search_model": ["main.user", "main.course"],

    # ── Прочее ──────────────────────────────────────────────
    "show_ui_builder":      False,
    "related_modal_active": True,
    "language_chooser":     False,
    "changeform_format":    "horizontal_tabs",

    "custom_css": "admin/css/erudito_admin.css",
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text":        False,
    "footer_small_text":        False,
    "body_small_text":          False,
    "brand_small_text":         False,

    "brand_colour":             "navbar-dark",
    "accent":                   "accent-warning",
    "navbar":                   "navbar-dark",
    "no_navbar_border":         True,
    "navbar_fixed":             True,
    "layout_boxed":             False,
    "footer_fixed":             False,
    "sidebar_fixed":            True,
    "sidebar":                  "sidebar-dark-warning",
    "sidebar_nav_small_text":   False,
    "sidebar_disable_expand":   False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style":False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style":   False,

    "theme":                    "darkly",
    "dark_mode_theme":          "darkly",

    "button_classes": {
        "primary":   "btn-primary",
        "secondary": "btn-secondary",
        "info":      "btn-info",
        "warning":   "btn-warning",
        "danger":    "btn-danger",
        "success":   "btn-success",
    },
}

# ══════════════════════════════════════════════════════════════

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Erudito.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Erudito.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'main.User'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE     = 'UTC'
USE_I18N      = True
USE_TZ        = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]
STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL  = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
