# AI chat_app — AGENTS.md

## Overview

MERN stack real-time code collaboration platform. Two packages (`backend/`, `frontend/`), no monorepo tooling. ESM (`"type": "module"`) throughout.

## Quick start

```bash
# Backend (terminal 1)
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, REDIS_*, GOOGLE_AI_KEY
npm install && npm start

# Frontend (terminal 2)
cd frontend
npm run dev
```

Backend: port 3000, Frontend: port 5173 (Vite default).

## Commands

| Package | Command | Purpose |
|---------|---------|---------|
| backend | `npm start` | Run production server (`node server.js`) |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Vite production build |
| frontend | `npm run lint` | ESLint 9 flat config (`eslint.config.js`) |
| frontend | `npm run preview` | Preview production build |

No tests exist (`echo "Error: no test specified"`). No CI, no pre-commit hooks, no formatter config.

## Architecture

### Backend (`backend/`)

- **Entry**: `server.js` (creates HTTP server + Socket.io), `app.js` (Express setup)
- **Layers**: `controllers/` → `services/` → `models/`
- **Middleware stack**: helmet → mongo-sanitize → morgan → cors → json/cookie-parser → COOP/COEP headers
- **Rate limiting**: auth routes `15min/10req`, AI route `1min/10req`
- **Error handling**: custom `AppError` hierarchy (`utils/errors.js`), centralized `errorHandler` middleware
- **Auth**: JWT (24h expiry), extracted from `cookie` or `Authorization: Bearer` header, Redis-backed token blacklisting
- **Socket.io**: JWT + projectId validation in `socketMiddleware` (`auth.middleware.js:32`)
- **Redis**: optional — all Redis calls use `safeRedisGet`/`safeRedisSet` that degrade gracefully if Redis is down
- **MongoDB retry**: up to 5 retries with 5s delay (`database/db.js`)
- **Graceful shutdown**: SIGTERM/SIGINT handler (`server.js:56`)

### Frontend (`frontend/`)

- **Entry**: `main.jsx` → `App.jsx` (ErrorBoundary > UserProvider > ToastProvider > AppRoutes)
- **Router**: React Router DOM v7, `BrowserRouter`, all authenticated routes wrapped in `<UserAuth>` (`auth/UserAuth.jsx`)
- **Contexts**: `UserContext` (auth state), `ToastContext` (notification system)
- **Config modules**: `config/axios.js` (interceptors for token + 401 redirect), `config/socket.js` (Socket.io client), `config/webContainer.js` (WebContainer singleton)
- **Styling**: Tailwind CSS 3 + PostCSS, no CSS modules or styled-components

### Data flow

1. User types `@ai <prompt>` in project chat → `project-message` socket event
2. Backend detects `@ai`, strips prefix, calls `Gemini 3.1 Flash Lite` (named `gemini-3.1-flash-lite` in code)
3. AI returns JSON with `{ text, fileTree, buildCommand, startCommand }`
4. Frontend parses response, mounts `fileTree` into WebContainer, renders files
5. User clicks "play" → `npm start` in WebContainer → `server-ready` event → iframe preview

## Key quirks & gotchas

- **Project owner** = `users[0]`. Only owner can delete, rename, or remove collaborators. `lowercase: true` on project names.
- **COOP/COEP headers** required for WebContainer. Set in 3 places: `vite.config.js` (dev), `app.js:49` (backend proxy), `vercel.json` (deploy).
- **`requestId.js`** middleware exists but is NOT imported in `app.js`.
- **Socket.io project ID** validated with `mongoose.Types.ObjectId.isValid` before DB lookup (`auth.middleware.js:39`).
- **AI model** uses a non-standard name `gemini-3.1-flash-lite` and requires JSON response mode (`responseMimeType: "application/json"`).
- **`hooks/` directory** exists but is empty — not used.
- **npx** listed as dependency in backend package.json but never imported (morgan is the logging middleware used instead).
- **Syntax highlighting**: `react-syntax-highlighter` with `atomOneDark` theme, language mapping in `Project.jsx:17`.
- **Toast** is a custom context (`ToastContext.jsx`), not a library.
- **AI rate limit**: 10 requests per minute per user.
- **WebContainer singleton**: booted once (`getWebContainer`), reused across project navigation.
