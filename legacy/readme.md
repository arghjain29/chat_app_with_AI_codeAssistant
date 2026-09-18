# CodeCollab - AI-Powered Code Collaboration Platform

A full-stack real-time code collaboration platform with AI code generation, built on the MERN stack. Users can create projects, collaborate in real-time chat, generate code with AI, and run projects directly in the browser via WebContainer.

## Features

- **User Authentication** - Register/login with JWT, password hashing, token blacklisting
- **Project Management** - Create, rename, delete projects; add/remove collaborators
- **Real-time Chat** - Socket.io-powered messaging within project rooms
- **AI Code Assistant** - Google Gemini integration triggered with `@ai` prefix
- **Code Editor** - CodeMirror 6 with syntax highlighting, line numbers, bracket matching
- **In-Browser Execution** - WebContainer runs generated code with live preview
- **User Profiles** - Edit username, change password, delete account
- **Toast Notifications** - Non-intrusive feedback for all actions
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

### Frontend
- React 18 + Vite
- React Router DOM v7
- Tailwind CSS
- CodeMirror 6 (editor)
- Socket.io Client
- Axios
- markdown-to-jsx
- WebContainer API
- RemixIcon

### Backend
- Node.js + Express
- MongoDB + Mongoose
- Redis (ioredis) - token blacklisting
- Socket.io
- Google Generative AI (Gemini)
- JWT + bcrypt
- helmet, express-rate-limit, express-mongo-sanitize
- pino (structured logging)

## Project Structure

```
├── backend/
│   ├── controllers/      # Request handlers
│   ├── database/         # MongoDB connection
│   ├── middleware/        # Auth, error handler, request ID
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   ├── utils/            # Error classes, logger
│   ├── app.js            # Express app setup
│   └── server.js         # HTTP + Socket.io server
│
├── frontend/
│   └── src/
│       ├── auth/         # Route guards
│       ├── components/   # Reusable UI (Navbar, Toast, etc.)
│       ├── config/       # Axios, Socket, WebContainer
│       ├── context/      # React Context providers
│       ├── hooks/        # Custom hooks
│       ├── routes/       # Route definitions
│       └── screens/      # Page components
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas (or local MongoDB)
- Redis (Redis Labs, Upstash, or local)

### Installation

```bash
git clone <repo-url>
cd AI_chat_app

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Environment Variables

Create `backend/.env` (see `backend/.env.example`):

```
PORT=3000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_strong_random_secret
FRONTEND_URL=http://localhost:5173
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
GOOGLE_AI_KEY=your_google_ai_key
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:3000
```

### Running

```bash
# Backend (terminal 1)
cd backend
npm start

# Frontend (terminal 2)
cd frontend
npm run dev
```

### Deployment

**Frontend (Vercel):**
- Connect repo, framework = Vercel
- Set `VITE_API_URL` to your backend URL
- `vercel.json` includes COOP/COEP headers for WebContainer

**Backend (Railway/Render):**
- Deploy as a Node.js service
- Set all environment variables
- No vendor-specific code - works with any Node.js host

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/register` | No | Register user |
| POST | `/api/users/login` | No | Login |
| GET | `/api/users/profile` | Yes | Get profile |
| PUT | `/api/users/update-profile` | Yes | Update username |
| PUT | `/api/users/change-password` | Yes | Change password |
| DELETE | `/api/users/delete-account` | Yes | Delete account |
| POST | `/api/users/logout` | Yes | Logout |
| GET | `/api/users/all` | Yes | List all users |
| POST | `/api/projects/create` | Yes | Create project |
| GET | `/api/projects/all` | Yes | List projects |
| GET | `/api/projects/get-project/:id` | Yes | Get project |
| PUT | `/api/projects/add-user` | Yes | Add collaborator |
| PUT | `/api/projects/remove-user` | Yes | Remove collaborator |
| PUT | `/api/projects/update-project/:id` | Yes | Rename project |
| DELETE | `/api/projects/delete-project/:id` | Yes | Delete project |
| GET | `/api/ai/get-result?prompt=...` | Yes | AI code generation |

## Usage

1. Register/login
2. Create a project
3. Add collaborators
4. Open the project, chat with team or use `@ai` for code generation
5. AI responses include file trees that auto-mount in WebContainer
6. Click files to view/edit, run with the play button, preview in the iframe

## License

MIT
