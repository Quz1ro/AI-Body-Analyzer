#  AI Body Analyzer

Веб-застосунок для автоматичного аналізу фізичної форми за фотографією з використанням комп'ютерного зору та AI.

##  Можливості

- ** Завантаження фото** — drag-and-drop або вибір файлу (JPG/PNG, до 10 МБ)
- ** Pose Estimation** — визначення 33 ключових точок тіла (MediaPipe Pose)
- ** Аналіз пропорцій** — плечі/талія, симетрія рук та ніг, довжина тулуба
- ** Оцінка постави** — нахил плечей, тазу, вирівнювання голови
- ** Слабкі зони** — автоматичне виявлення зон для покращення
- ** AI-асистент** — чат з AI-тренером для пояснення результатів та рекомендацій
- ** Дашборд** — історія аналізів та відстеження прогресу
- ** Авторизація** — JWT-based, з реєстрацією та відновленням

## 🛠️ Технологічний стек

| Шар | Технологія |
|-----|-----------|
| Frontend | Next.js 15, TypeScript, Vanilla CSS (Premium Glassmorphism Design) |
| Backend | Python, FastAPI, SQLAlchemy 2.0 (Async) |
| Комп'ютерний зір | MediaPipe Pose, OpenCV |
| AI-асистент | Google Gemini API (з автоматичним fallback та підтримкою ротації ключів) |
| База даних | PostgreSQL 16 (або SQLite для локальної розробки) |
| Інфраструктура | Docker, Docker Compose, run.bat (автоматичний запуск та налаштування) |

##  Структура проєкту

```
AI Body Analyzer/
├── run.bat                 # Скрипт автоматичного налаштування та запуску
├── docker-compose.yml      # Оркестрація контейнерів
├── .env.example            # Шаблон змінних середовища
├── gemini_keys.txt         # Список API ключів для ротації (опціонально)
├── frontend/               # Next.js додаток
│   ├── src/
│   │   ├── app/            # Сторінки (App Router)
│   │   ├── components/     # React компоненти
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client, utilities
│   │   └── types/          # TypeScript типи
│   └── Dockerfile
└── backend/                # FastAPI сервер
    ├── app/
    │   ├── api/            # REST API routes
    │   ├── models/         # SQLAlchemy ORM моделі
    │   ├── schemas/        # Pydantic schemas
    │   ├── services/       # CV, AI, бізнес-логіка
    │   └── core/           # Security, dependencies
    ├── alembic/            # Міграції БД
    └── Dockerfile
```

##  Швидкий старт

### Передумови

- [Node.js 20+](https://nodejs.org/) (для локальної розробки frontend)
- [Python 3.11+](https://python.org/) (для локальної розробки backend)
- [Docker Desktop](https://docs.docker.com/get-docker/) (опціонально, для запуску в контейнерах)

### Найпростіший запуск (Windows)

Просто запустіть файл `run.bat` у кореневій директорії проєкту. 
Скрипт автоматично:
1. Перевірить наявність Python та Node.js.
2. Створить віртуальне оточення Python (`backend/.venv`) та встановить необхідні залежності.
3. Встановить залежності для Next.js (`frontend/node_modules`).
4. Запустить бекенд та фронтенд у паралельних вікнах консолі.
5. Відкриє застосунок у вашому браузері за адресою [http://localhost:3000](http://localhost:3000).

---

### Альтернативний запуск

### 1. Клонування та налаштування
```bash
cd "AI Body Analyzer"
cp .env.example .env
# Відредагуйте .env або створіть gemini_keys.txt для роботи AI-чату
```

### 2. Запуск через Docker Compose
```bash
docker-compose up --build
```
Після запуску:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Локальний ручний запуск (без Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
# або source .venv/bin/activate для macOS/Linux
pip install -e .
pip install bcrypt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

##  Налаштування AI (Google Gemini)

Для роботи ШІ-асистента та генерації детальних звітів необхідно налаштувати API ключ одним із двох способів:
1. Додати рядок `LLM_API_KEY=ваш_ключ` у файл `.env`.
2. Або створити файл `gemini_keys.txt` у корені проєкту та вказати один або кілька ключів через кому чи з нового рядка (система підтримує автоматичну ротацію ключів у разі лімітів).

*Якщо ключів немає, застосунок працюватиме у режимі fallback (локальні евристичні розрахунки та фіксовані відповіді асистента).*

## 📡 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | ❌ | Реєстрація |
| POST | /api/auth/login | ❌ | Авторизація |
| POST | /api/auth/refresh | 🔄 | Оновлення токена |
| GET | /api/users/me | ✅ | Профіль |
| PATCH | /api/users/me | ✅ | Оновлення профілю |
| DELETE | /api/users/me | ✅ | Видалення акаунта |
| POST | /api/images | ✅ | Завантаження фото |
| GET | /api/images | ✅ | Список фото |
| POST | /api/analysis | ✅ | Запуск аналізу |
| GET | /api/analysis | ✅ | Історія аналізів |
| GET | /api/analysis/{id} | ✅ | Деталі аналізу |
| POST | /api/assistant/chat | ✅ | Чат з AI |
| GET | /api/assistant/history | ✅ | Історія чату |

##  Дисклеймер

Цей інструмент надає **орієнтовну оцінку** на основі 2D-фотографії і **не є медичним засобом**. Точність залежить від якості фото, ракурсу та освітлення. Завжди консультуйтесь з лікарем або сертифікованим тренером.

##  Ліцензія

MIT
