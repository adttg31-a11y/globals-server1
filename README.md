# Globals WebSocket Server

Сервер для синхронизации пользователей мода Zenith.

## Деплой на Render.com (Бесплатно)

### 1. Подготовка

1. Создай аккаунт на [render.com](https://render.com)
2. Создай GitHub репозиторий
3. Загрузи папку `globals-server` в репозиторий

### 2. Деплой

1. В Render нажми **"New +"** → **"Web Service"**
2. Подключи свой GitHub репозиторий
3. Настройки:
   - **Name**: `globals-server` (или любое имя)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Нажми **"Create Web Service"**

### 3. Получи URL

После деплоя получишь URL типа:
```
https://globals-server.onrender.com
```

Для WebSocket используй:
```
wss://globals-server.onrender.com
```

### 4. Настрой мод

В игре в настройках модуля **GlobalsMenu** измени **Server URL** на:
```
wss://globals-server.onrender.com
```

---

## Альтернативные бесплатные хостинги

### Railway.app
1. Зарегистрируйся на [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Выбери репозиторий
4. URL: `wss://globals-server.up.railway.app`

### Glitch.com
1. Зайди на [glitch.com](https://glitch.com)
2. "New Project" → "glitch-hello-node"
3. Замени файлы `package.json` и `server.js`
4. URL: `wss://your-project.glitch.me`

---

## Локальный запуск (для тестирования)

```bash
cd globals-server
npm install
npm start
```

Сервер запустится на `ws://localhost:8081`

---

## Протокол

### Клиент -> Сервер

**Регистрация пользователя:**
```json
{
  "type": "register",
  "username": "PlayerName"
}
```

### Сервер -> Клиент

**Список пользователей (при подключении):**
```json
{
  "type": "userlist",
  "users": ["Player1", "Player2", "Player3"]
}
```

**Новый пользователь подключился:**
```json
{
  "type": "user_join",
  "username": "PlayerName"
}
```

**Пользователь отключился:**
```json
{
  "type": "user_leave",
  "username": "PlayerName"
}
```

---

## Важно

- Render.com усыпляет бесплатные сервисы после 15 минут неактивности
- Первое подключение может занять 30-60 секунд (пока сервер просыпается)
- Для постоянной работы рассмотри платный план ($7/месяц)

---

## Использование

1. Запусти/задеплой сервер
2. В игре включи модуль "GlobalsMenu"
3. Перед никами игроков, использующих мод, появится буква "M" синего цвета
