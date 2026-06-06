from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0005_review'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Conclusion',
        ),
    ]
