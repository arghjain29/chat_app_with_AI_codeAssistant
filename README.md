# CodeCollab

A collaborative code workspace: a shared editor with live cursors, persistent team chat, and an AI pair-programmer everyone in the project can see. Free and Pro plans with Stripe subscriptions (test mode).

> **Status:** v2 rebuild in progress on the `v2` branch. The original v1 app lives in [`legacy/`](legacy/) for reference. The full design is in [`docs/superpowers/specs/2026-09-18-codecollab-v2-design.md`](docs/superpowers/specs/2026-09-18-codecollab-v2-design.md).

## Roadmap

| Phase | Scope                                                                            | Status |
| ----- | -------------------------------------------------------------------------------- | ------ |
| 0     | Foundation: TypeScript workspace, Clerk auth, API skeleton, CI                   | Done   |
| 1     | Projects, roles (owner/editor/viewer), invite links, plan limits                 | Done   |
| 2     | Workspace: file tree, live co-editing (Yjs), in-browser run & preview            | Next   |
| 3     | Persistent chat: threads, reactions, mentions, unread                            |        |
| 4     | AI gateway: multi-provider, streaming, diff proposals, quotas & abuse protection |        |
| 5     | Billing: Stripe Checkout, Customer Portal, webhooks, entitlements                |        |
| 6     | Polish: landing page, onboarding, Sentry, Playwright e2e, deploy                 |        |

## Stack

- **frontend/**: React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Radix UI, Clerk
- **backend/**: Node 22+, Express 5, Mongoose (MongoDB), ioredis (optional), pino, Clerk, Zod
- **shared/**: Zod schemas, types, plan limits and error codes used by both apps

It is one git repo with three npm workspaces. The frontend deploys to Vercel (root directory `frontend`), and the backend deploys to Render (root directory `backend`).

## Local setup

Requirements: Node 22+, a MongoDB database (local or free [Atlas](https://www.mongodb.com/atlas)), and a free [Clerk](https://clerk.com) application.

```bash
npm install

cp backend/.env.example backend/.env     # fill in MONGO_URI and the Clerk keys
cp frontend/.env.example frontend/.env   # fill in VITE_CLERK_PUBLISHABLE_KEY

npm run dev    # API on http://localhost:3000, web on http://localhost:5173
```

In the Clerk dashboard, enable **Email + password** and **Google** under _User & authentication_.
The Clerk webhook (`POST /webhooks/clerk`, events `user.*`) keeps profile changes and deletions in sync. It's optional locally, because users are also created on their first API request.

## Scripts (run from the repo root)

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Start API and web together                            |
| `npm run build`     | Production build of both apps                         |
| `npm run lint`      | ESLint across all workspaces                          |
| `npm run typecheck` | TypeScript checks for every workspace                 |
| `npm test`          | Vitest suites (the backend uses an in-memory MongoDB) |
| `npm run format`    | Prettier                                              |

## API conventions

- All endpoints live under `/api/v1` and authenticate with a Clerk session token (`Authorization: Bearer …`).
- Errors always have the shape `{ "error": { "code", "message", "requestId", "details?" } }`. Codes are listed in `shared/src/errors.ts`.
- Every response carries an `x-request-id` header, which is also written to the logs.
- `GET /health` reports liveness; `GET /ready` checks MongoDB and Redis.
