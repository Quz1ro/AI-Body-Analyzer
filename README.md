# 🏋️ AI Body Analyzer

Веб-застосунок для автоматичного аналізу фізичної форми за фотографією з використанням комп'ютерного зору та AI.

## 🚀 Можливості

- **📸 Завантаження фото** — drag-and-drop або вибір файлу (JPG/PNG, до 10 МБ)
- **🦴 Pose Estimation** — визначення 33 ключових точок тіла (MediaPipe Pose)
- **📐 Аналіз пропорцій** — плечі/талія, симетрія рук та ніг, довжина тулуба
- **🧍 Оцінка постави** — нахил плечей, тазу, вирівнювання голови
- **💪 Слабкі зони** — автоматичне виявлення зон для покращення
- **🤖 AI-асистент** — чат з AI-тренером для пояснення результатів та рекомендацій
- **📊 Дашборд** — історія аналізів та відстеження прогресу
- **🔐 Авторизація** — JWT-based, з реєстрацією та відновленням

## 🛠️ Технологічний стек

| Шар | Технологія |
|-----|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy 2.0 |
| Комп'ютерний зір | MediaPipe Pose, OpenCV |
| AI-асистент | OpenAI GPT API (з fallback) |
| База даних | PostgreSQL 16 |
| Інфраструктура | Docker, Docker Compose |

## 📁 Структура проєкту

```
AI Body Analyzer/
├── docker-compose.yml      # Оркестрація контейнерів
├── .env.example            # Шаблон змінних середовища
├── frontend/               # Next.js додаток
│   ├── src/
│   │   ├── app/            # Сторінки (App Router)
│   │   ├── components/     # React компоненти
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client, utilities
│   │   └── types/          # TypeScript типи
│   └── Dockerfile
├── backend/                # FastAPI сервер
│   ├── app/
│   │   ├── api/            # REST API routes
│   │   ├── models/         # SQLAlchemy ORM моделі
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # CV, AI, бізнес-логіка
│   │   └── core/           # Security, dependencies
│   ├── alembic/            # Міграції БД
│   └── Dockerfile
└── docs/
```

## 🚀 Швидкий старт

### Передумови

- [Docker Desktop](https://docs.docker.com/get-docker/)
- [Node.js 20+](https://nodejs.org/) (для локальної розробки frontend)
- [Python 3.12+](https://python.org/) (для локальної розробки backend)

### 1. Клонування та налаштування

```bash
cd "AI Body Analyzer"
cp .env.example .env
# Відредагуйте .env: додайте LLM_API_KEY якщо хочете AI-чат
```

### 2. Запуск через Docker Compose

```bash
docker-compose up --build
```

Після запуску:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Локальна розробка (без Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**PostgreSQL** потрібен окремо (або через Docker):
```bash
docker run -d --name pg -p 5432:5432 -e POSTGRES_DB=body_analyzer -e POSTGRES_USER=app -e POSTGRES_PASSWORD=devpassword123 postgres:16-alpine
```

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

## ⚠️ Дисклеймер

Цей інструмент надає **орієнтовну оцінку** на основі 2D-фотографії і **не є медичним засобом**. Точність залежить від якості фото, ракурсу та освітлення. Завжди консультуйтесь з лікарем або сертифікованим тренером.

## 📝 Ліцензія

MIT
