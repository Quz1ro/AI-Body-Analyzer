<div align="center">

# AI Body Analyzer

**Інтелектуальний аналіз фізичної форми на основі комп'ютерного зору та штучного інтелекту**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-API-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

Завантажте фото — отримайте детальний звіт з оцінкою пропорцій, постави, слабких зон та персоналізовані рекомендації від AI-тренера в реальному часі.

</div>

---

## Highlights

- **Computer Vision** — MediaPipe Pose визначає 33 ключові точки тіла і будує скелетну модель
- **AI-Powered Analysis** — Google Gemini генерує детальні звіти з рейтингами та рекомендаціями
- **Real-time Streaming** — AI-асистент друкує відповіді в реальному часі через SSE
- **Premium UI** — Glassmorphism дизайн, плавні анімації, адаптивний інтерфейс
- **One-click Start** — `run.bat` автоматично налаштовує та запускає весь стек

---

## Features

### Аналіз тіла
| Функція | Опис |
|---------|------|
| Завантаження фото | Drag-and-drop або вибір файлу (JPG / PNG, до 10 МБ) |
| Pose Estimation | Визначення 33 ключових точок тіла через MediaPipe Pose |
| Аналіз пропорцій | Співвідношення плечі / талія, симетрія рук та ніг |
| Оцінка постави | Нахил плечей, тазу, вирівнювання голови |
| Слабкі зони | Автоматичне виявлення зон для покращення з рекомендаціями |
| Фітнес-рейтинг | Загальна оцінка форми від 1 до 10 |

### AI-асистент
| Функція | Опис |
|---------|------|
| Чат з контекстом | AI-тренер з доступом до результатів вашого аналізу |
| Стрімінг в реальному часі | Відповіді друкуються посимвольно через SSE (як ChatGPT) |
| Рекомендації | Персоналізовані поради щодо тренувань та харчування |
| Історія чату | Зберігання всіх діалогів з прив'язкою до аналізу |

### Платформа
| Функція | Опис |
|---------|------|
| Авторизація | JWT-based з реєстрацією, email-верифікацією та refresh-токенами |
| Дашборд | Історія аналізів та відстеження прогресу |
| Профіль | Управління акаунтом, зміна даних, видалення |
| Email-верифікація | Підтвердження пошти через SMTP (Gmail) |

---

## Tech Stack

```
Frontend                    Backend                     Infrastructure
─────────────────────       ─────────────────────       ──────────────────
Next.js 16                  Python 3.11+                Docker + Compose
React 19                    FastAPI                     PostgreSQL 16
TypeScript 5                SQLAlchemy 2.0 (Async)      SQLite (dev mode)
Vanilla CSS                 Alembic (migrations)        run.bat (auto-setup)
Inter (Google Fonts)        MediaPipe Pose              Uvicorn (ASGI)
                            OpenCV
                            Google Gemini API
                            SMTP (email)
```

---

## Quick Start

### Автоматичний запуск (Windows)

```bash
git clone https://github.com/Quz1ro/AI-Body-Analyzer.git
cd AI-Body-Analyzer
```

Запустіть `run.bat` — скрипт автоматично:

1. Перевірить наявність Python та Node.js
2. Створить віртуальне оточення та встановить залежності
3. Запустить backend та frontend
4. Відкриє http://localhost:3000 у браузері

### Docker Compose

```bash
cp .env.example .env
# Відредагуйте .env — додайте API ключі
docker-compose up --build
```

| Сервіс | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

### Ручний запуск

<details>
<summary><b>Backend</b></summary>

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -e .
pip install bcrypt
uvicorn app.main:app --reload
```

</details>

<details>
<summary><b>Frontend</b></summary>

```bash
cd frontend
npm install
npm run dev
```

</details>

---

## Configuration

### Google Gemini API

AI-асистент та генерація звітів вимагають API ключ Google Gemini.

**Варіант 1** — через `.env`:
```env
LLM_PROVIDER=gemini
LLM_API_KEY=your-api-key
```

**Варіант 2** — ротація ключів через `gemini_keys.txt`:
```
key-1
key-2
key-3
```

> Система автоматично ротує ключі при досягненні лімітів. Якщо ключів немає — працює fallback-режим з локальними евристичними розрахунками.

### Email-верифікація (опціонально)

```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/auth/register` | — | Реєстрація нового користувача |
| `POST` | `/api/auth/login` | — | Авторизація |
| `POST` | `/api/auth/refresh` | 🔄 | Оновлення access-токена |
| `GET` | `/api/auth/verify-email` | — | Підтвердження email |
| `POST` | `/api/auth/resend-verification` | ✅ | Повторне відправлення листа |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/users/me` | ✅ | Отримати профіль |
| `PATCH` | `/api/users/me` | ✅ | Оновити профіль |
| `DELETE` | `/api/users/me` | ✅ | Видалити акаунт |

### Images & Analysis
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/images` | ✅ | Завантажити фото |
| `GET` | `/api/images` | ✅ | Список фото |
| `POST` | `/api/analysis` | ✅ | Запустити аналіз |
| `GET` | `/api/analysis` | ✅ | Історія аналізів |
| `GET` | `/api/analysis/{id}` | ✅ | Деталі аналізу |
| `GET` | `/api/analysis/scan-limit` | ✅ | Перевірити ліміт сканувань |

### AI Assistant
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/assistant/chat` | ✅ | Відправити повідомлення |
| `POST` | `/api/assistant/chat/stream` | ✅ | Стрімінг відповіді (SSE) |
| `GET` | `/api/assistant/history` | ✅ | Історія чату |

---

## Project Structure

```
AI-Body-Analyzer/
├── run.bat                          # Auto-setup & launch script
├── docker-compose.yml               # Container orchestration
├── .env.example                     # Environment template
├── gemini_keys.txt                  # API key rotation (optional)
│
├── frontend/                        # Next.js 16 application
│   └── src/
│       ├── app/                     # Pages (App Router)
│       │   ├── api/assistant/       # Streaming proxy route
│       │   ├── analysis/            # Analysis results page
│       │   ├── assistant/           # AI chat page
│       │   ├── auth/                # Login / Register / Verify
│       │   ├── dashboard/           # User dashboard
│       │   └── profile/             # User profile
│       ├── components/              # Reusable UI components
│       ├── hooks/                   # Custom React hooks
│       ├── lib/                     # API client & utilities
│       └── types/                   # TypeScript definitions
│
└── backend/                         # FastAPI server
    └── app/
        ├── api/                     # REST API routes
        ├── models/                  # SQLAlchemy ORM models
        ├── schemas/                 # Pydantic validation schemas
        ├── services/                # CV, AI & business logic
        ├── core/                    # Security & dependencies
        └── utils/                   # Helper utilities
```

---

## Disclaimer

> Цей інструмент надає **орієнтовну оцінку** на основі 2D-фотографії і **не є медичним засобом**. Точність залежить від якості фото, ракурсу та освітлення. Завжди консультуйтесь з лікарем або сертифікованим тренером.

---

<div align="center">

## License

MIT © 2026

**Built with** ❤️ **and** 🤖

</div>
