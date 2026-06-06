from django import forms
from django.contrib.auth.password_validation import validate_password
from .models import User

class RegisterForm(forms.ModelForm):
    password = forms.CharField(
        widget=forms.PasswordInput,
        validators=[validate_password],
        label='Пароль',
    )

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', 'role']
        error_messages = {
            'first_name': {'required': 'Введите имя.'},
            'last_name':  {'required': 'Введите фамилию.'},
            'email':      {
                'required': 'Введите электронную почту.',
                'invalid':  'Введите корректный email адрес.',
                'unique':   'Пользователь с такой почтой уже существует.',
            },
        }

    def clean_email(self):
        email = self.cleaned_data['email'].lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError('Пользователь с такой почтой уже существует.')
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user

