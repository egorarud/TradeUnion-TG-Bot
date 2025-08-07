# Установка и настройка TradeUnion-TG-Bot

## 1. Требования

- Node.js (рекомендуется версия 16.x или выше)
- npm (устанавливается вместе с Node.js)
- PostgreSQL (используется как основная СУБД)
- Git

## 2. Клонирование репозитория

```bash
git clone <URL_вашего_репозитория>
cd TradeUnion-TG-Bot
```

## 3. Установка зависимостей

```bash
npm install
```

## 4. Настройка переменных окружения

Создайте файл `.env` в корне проекта и добавьте туда следующие переменные:

```
# Токен Telegram-бота (получить у @BotFather)
BOT_TOKEN=ваш_токен_бота

# Строка подключения к PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# Список Telegram ID администраторов (через запятую)
ADMIN_IDS=123456789,987654321

# ID группового чата для уведомлений (опционально)
GROUP_CHAT_ID=-1001234567890

# Ключ OpenAI API (для работы с ИИ)
OPENAI_API_KEY=ваш_ключ_OpenAI
```

> **Примечание:**  
> - Получить токен бота можно у [BotFather](https://t.me/BotFather).  
> - Строку подключения к PostgreSQL можно сгенерировать, например, так:  
>   `postgresql://postgres:password@localhost:5432/tradeunion_db`

## 5. Настройка базы данных

Выполните миграции для создания таблиц в вашей базе данных:

```bash
npx prisma migrate deploy
```

или для разработки:

```bash
npx prisma migrate dev
```

## 6. Запуск бота

```bash
npm start
```
или для разработки с автоматической перезагрузкой:
```bash
npm run dev
```

## 7. Структура проекта

- Основной файл запуска: `src/bot.js`
- Логика админ-панели: `src/admin/`
- Работа с базой данных: Prisma, схема — `prisma/schema.prisma`
- Логирование: `src/utils/logger.js`, логи — в папке `logs/`