from django.urls import path
from . import views

urlpatterns = [

    # ── Главная ─────────────────────────────────────────────────
    path('', views.mainPage, name='home'),

    # ── Авторизация ──────────────────────────────────────────────
    path('register/', views.register_view, name='register'),
    path('login/',    views.login_view,    name='login'),
    path('logout/',   views.logout_view,   name='logout'),

    path('courses/', views.courses_catalog, name='courses_catalog'),
    path('courses/<int:course_id>/', views.course_detail, name='course_detail'),
    path('student/courses/<int:course_id>/learn/<int:lesson_id>/',views.course_learn,name='course_learn'),

    # ── Личный кабинет студента ──────────────────────────────────
    path('student/dashboard/',
         views.student_dashboard, name='student_dashboard'),

    path('student/enroll/<int:course_id>/',
         views.student_enroll, name='student_enroll'),

    path('student/unenroll/<int:enrollment_id>/',
         views.student_unenroll, name='student_unenroll'),

    path('student/courses/<int:course_id>/lessons/<int:lesson_id>/done/',
         views.mark_lesson_done, name='mark_lesson_done'),

    path('student/courses/<int:course_id>/review/',
         views.submit_review, name='submit_review'),

    # ── Курсы преподавателя ──────────────────────────────────────
    path('teacher/courses/',
         views.teacher_courses,      name='teacher_courses'),

    path('teacher/courses/create/',
         views.create_course,        name='create_course'),

    path('teacher/courses/<int:course_id>/edit/',
         views.teacher_course_edit,  name='teacher_course_edit'),

    path('teacher/courses/<int:course_id>/delete/',
         views.delete_course,        name='delete_course'),

    path('teacher/courses/<int:course_id>/toggle-publish/',
         views.toggle_publish_course, name='toggle_publish_course'),

    # ── Уроки ────────────────────────────────────────────────────
    path('teacher/courses/<int:course_id>/lessons/create/',
         views.create_lesson,   name='create_lesson'),

    path('teacher/courses/<int:course_id>/lessons/reorder/',
         views.reorder_lessons, name='reorder_lessons'),

    path('teacher/courses/<int:course_id>/lessons/<int:lesson_id>/',
         views.get_lesson,      name='get_lesson'),

    path('teacher/courses/<int:course_id>/lessons/<int:lesson_id>/update/',
         views.update_lesson,   name='update_lesson'),

    path('teacher/courses/<int:course_id>/lessons/<int:lesson_id>/delete/',
         views.delete_lesson,   name='delete_lesson'),

    # ── Материалы уроков ─────────────────────────────────────────
    path('teacher/courses/<int:course_id>/lessons/<int:lesson_id>/materials/create/',
         views.create_lesson_material, name='create_lesson_material'),

    path('teacher/courses/<int:course_id>/lessons/<int:lesson_id>/materials/<int:material_id>/delete/',
         views.delete_lesson_material, name='delete_lesson_material'),
]