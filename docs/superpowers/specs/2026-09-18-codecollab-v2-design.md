# CodeCollab v2 — from project to product

## Context

Today CodeCollab is a MERN app of about 3k lines of code. Users create projects, chat over Socket.io, and type `@ai` to have Gemini return a JSON file tree. That tree is mounted in a WebContainer and previewed in the browser. The goal is a **portfolio-grade product**: a collaborative code workspace with product-quality UX, a secure multi-provider AI layer, and a working (test-mode) subscription system. Everything is deployed on free tiers and structured so it could go live later.

Problems found in the current code, which drive the rebuild:
- **Authorization holes.**
  - Any logged-in user can join any project's socket room, and can `GET /api/projects/get-project/:id` without being a member (`backend/middleware/auth.middleware.js:32`, `project.controller.js getByProjectIdController`).
  - The client sets `sender`, so users can impersonate others, including `CodeAI` (`backend/server.js:27`).
  - `/api/users/all` lists every user.
- **AI abuse.** AI calls over the socket skip the rate limiter entirely (`server.js`). There are no quotas, no token or cost tracking, no streaming, and the JSON is enforced only by prompt examples (`services/ai.service.js`).
- **No persistence.** Chat messages and generated files are lost on reload.
- **Weak auth.** JWTs are in `localStorage`, there are no refresh tokens, no email verification, and no password reset. `authLimiter` (10 requests / 15 min) also applies to `/profile` and `/all`.
- **Data model.** The owner is simply `users[0]`, there are no roles, and project names are unique across all users.
- **Engineering.** No TypeScript, no tests, no CI. `Project.jsx` is a single 700-line component.

## Decisions (confirmed with user)

| Area | Choice |
|---|---|
| Product | Collaborative code workspace (team IDE + persistent chat + AI pair-programmer) |
| Goal | Portfolio-grade showcase, free tiers, payments in **test mode** |
| Code layout | Fresh TypeScript rebuild in `frontend/` + `backend/` + `shared/` using **npm workspaces** (no pnpm, no Turborepo). Current code moves to `legacy/` as reference. |
| Frontend | Vite + React 19 + TanStack Router/Query + Tailwind v4 + shadcn/ui |
| Auth | **Clerk** (free ≤50k MRU): email+password (verification/reset built in) + Google OAuth (GitHub optional toggle) |
| AI | Multi-provider gateway (Gemini / Claude / OpenAI) via Vercel AI SDK, model tier by plan |
| Billing | **Stripe test mode** behind a `BillingProvider` interface; plans **Free / Pro** |
| Hosting | Vercel (frontend) + Render (backend + WebSockets) + MongoDB Atlas free + Upstash Redis free |
| v1 collab scope | Live co-editing (Yjs) + persistent chat with threads. Shared terminal/preview, Git/GitHub sync, BYOK, Team plan are **future**. |

## Architecture

```
frontend/  (Vercel)                 backend/  (Render, one Node process)
React SPA ──HTTPS REST──────────▶  Express 5 API  ── Mongo (Atlas)
   │  ──Socket.io (chat, AI)────▶  Socket.io + Redis adapter ── Redis (Upstash)
   │  ──WS /collab (Yjs)────────▶  Hocuspocus (Yjs server, persists to Mongo)
   │  Clerk (auth UI + tokens)      Clerk verifyToken · Stripe · AI gateway
   └─ WebContainer (in-browser run/preview; ported from legacy)
shared/  Zod schemas, TS types, socket event contracts, PLANS config, error codes
```

### Repo layout
```
package.json            (workspaces: frontend, backend, shared; root scripts: dev, build, lint, typecheck, test)
shared/src/{schemas,events,plans,errors}.ts
backend/src/{app.ts,server.ts,env.ts, modules/<feature>/{routes,controller,service,model}.ts, lib/{logger,redis,ratelimit}.ts, realtime/{socket,collab}.ts, ai/, billing/}
frontend/src/{routes/, features/<feature>/, components/ui (shadcn), lib/{api,socket,webcontainer}.ts}
legacy/{backend,frontend}  (moved with git mv, untouched)
.github/workflows/ci.yml
```
Backend is organized by feature module (auth, users, projects, files, chat, ai, billing), each with routes → controller → service → model, following the legacy layering.

### Reused from legacy (port to TS)
- `AppError` hierarchy → `backend/src/lib/errors.ts` (from `legacy/backend/utils/errors.js`) + central `errorHandler`
- Graceful Redis degradation (`safeRedisGet/Set` in `services/redis.service.js`)
- Mongo retry connect (`database/db.js`), graceful shutdown (`server.js`)
- `requestId` middleware (exists but was never wired up; wire it in)
- WebContainer singleton + mount/run/preview flow (`frontend/src/config/webContainer.js`, run logic in `screens/Project.jsx`)
- Language mapping for the editor (`Project.jsx:17`)
- COOP/COEP header setup (vite.config, vercel.json)

## Data model (Mongoose, types inferred from shared Zod)

- **User**: `clerkId` (unique), email, username, avatarUrl, `plan: 'free'|'pro'`, stripeCustomerId. Synced from Clerk webhooks (`user.created/updated/deleted`, verified with svix).
- **Project**: name, slug, description, ownerId, timestamps. Unique on `(ownerId, slug)`, not globally.
- **Membership**: projectId, userId, `role: owner|editor|viewer`. Unique on (projectId, userId). This is the **only** source of authorization.
- **Invite**: projectId, role, `tokenHash`, expiresAt, maxUses. Shareable invite link, so no email service is needed.
- **File**: projectId, path (validated: no `..`, no absolute paths, allow-listed characters), `yjsState: Buffer`, size, updatedAt. Unique on (projectId, path).
- **Message**: projectId, `parentId` (thread), `authorId | null`, `kind: user|ai|system`, content, mentions[], reactions, `ai: {model, provider, tokensIn, tokensOut, costMicros, proposal?}`, editedAt, deletedAt. Index on `(projectId, createdAt)`, with cursor pagination.
- **ReadState**: userId, projectId, lastReadAt → unread badges.
- **Subscription**: userId, providerSubId, status, priceId, interval, currentPeriodEnd, cancelAtPeriodEnd.
- **UsageCounter**: userId, periodKey (day/month), aiRequests, tokensIn, tokensOut, costMicros.
- **ProcessedWebhook**: provider + eventId, unique (idempotency for Stripe/Clerk).

## Plans (single source: `shared/src/plans.ts`)

| | Free | Pro ($10/mo · $96/yr, test mode) |
|---|---|---|
| Projects owned | 3 | Unlimited |
| Collaborators / project | 2 | 10 |
| AI requests | 30 / day | 1,500 / month |
| Models | Fast tier (Gemini Flash-Lite / Haiku) | + Premium tier (Claude Sonnet, Gemini Pro, GPT) |
| AI rate | 5 / min | 20 / min |
| Max context per request | 16k tokens | 64k tokens |

Limits are enforced on the backend (the source of truth). The UI reads the same config to show usage bars and upgrade prompts.

## Feature design

### 1. Auth & users (Clerk)
- Frontend uses `<ClerkProvider>`, `<SignIn/>`/`<SignUp/>` pages restyled to the app theme, `<UserButton/>`, and protected routes through a TanStack Router `beforeLoad` guard.
- Backend uses `@clerk/express` `clerkMiddleware()` + a `requireAuth` wrapper that resolves the local User by `clerkId`. The Socket.io handshake and Hocuspocus `onAuthenticate` verify the Clerk session token (`@clerk/backend verifyToken`); the client sends `await getToken()`.
- `/webhooks/clerk` keeps the User collection in sync. Account deletion cascades: owned projects, memberships, and the Stripe subscription is cancelled.

### 2. Projects, roles, invites
- REST (versioned `/api/v1`): projects CRUD, members list/update role/remove, invite create/revoke/accept. There is no global user listing: collaborators join through invite links.
- `requireProjectRole(minRole)` middleware is used by REST, Socket.io and Hocuspocus. Viewers get read-only editors and cannot run AI edits.
- Plan limit checks on create project / accept invite.

### 3. Workspace: live co-editing
- IDE layout with `react-resizable-panels`:
  - left: file tree (create, rename, delete, drag-to-move)
  - centre: editor tabs
  - right: Chat / AI panel
  - bottom: Run panel (WebContainer terminal output via xterm.js + preview iframe)
- CodeMirror 6 + `y-codemirror.next` + `@hocuspocus/provider`: one Y.Doc per file (`doc name = project:{id}:file:{fileId}`), live cursors and selections with user colours, and a presence avatar stack.
- Hocuspocus is mounted on the same HTTP server at `/collab`. The `onLoadDocument`/`onStoreDocument` hooks (debounced) persist to `File.yjsState`, and the Redis extension handles multi-instance.
- File-tree changes are broadcast through Socket.io events (`file:created|renamed|deleted`).
- Run: the file snapshot from the Y.Docs is mounted into the WebContainer, which runs `npm install` + the start command per user (a shared run is future).

### 4. Persistent chat + threads
- Socket events are typed in `shared/src/events.ts`: `message:send|new|edit|delete|react`, `typing`, `presence`, `thread:reply`. Each payload is validated with Zod on the server, and the server stamps `authorId`, so clients can't spoof senders.
- Features: history via cursor-paginated REST, threads (side panel), reactions, @mentions (members + `@ai`), edit/delete own messages, unread counts, typing indicators, markdown rendering with Shiki code blocks, message length cap (4k chars).
- Socket rate limit: 10 messages / 10 s per user.

### 5. AI gateway (`backend/src/ai/`)
- **Language-agnostic** (decided 2026-09-18): the assistant helps with code in any language, not only MERN as in v1. Its prompts must not assume a stack. Running stays limited to what WebContainer supports (see the runtime detection in `frontend/src/features/workspace/runtime.ts`), and the AI should say so rather than promise that non-JS code runs.
- `gateway.ts` exposes `runAi({ task, projectId, userId, messages, context })`. Built on the **Vercel AI SDK** (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`).
- `models.ts` maps each plan tier + task to an ordered provider/model list, for example `chat.fast → [gemini-flash-lite, claude-haiku]`. Failover moves to the next model on timeout, 429 or 5xx. Providers without an API key are skipped, so a single Gemini key is enough to run everything.
- **Streaming to the room.** Tokens stream over Socket.io (`ai:delta`, `ai:done`, `ai:error`) so every collaborator watches the answer form. The final message is persisted with its metadata.
- **Structured edits.** Tool calls (`create_file`, `edit_file` search/replace, `delete_file`) are validated with Zod, and paths must pass the File path validator. They produce a **proposal** shown as a diff card: Accept applies the change as a Yjs transaction (so everyone sees it), Reject discards it. This replaces the free-form "AI returns the whole file tree" approach.
- Context builder: the open file + selected files + recent thread messages, trimmed to the plan's token budget.
- Editor action: "Ask AI about selection" (explain/fix), which routes into the same pipeline.
- **Protection layer** (`ai/guard.ts`), run before every call:
  1. Role check (editor+)
  2. Per-user sliding-window rate limit (`rate-limiter-flexible` + Redis)
  3. Quota reservation: an atomic Redis counter, reconciled to UsageCounter after the call
  4. One in-flight AI request per user per project
  5. Input caps (characters/tokens)
  6. Global daily spend ceiling via `AI_DAILY_BUDGET_USD`, acting as a kill switch
  7. Cancellation propagated through `AbortController`, including on client "Stop"
- **Prompt-injection hardening:**
  - pinned system prompt, with user and file content wrapped in delimited blocks and labelled as untrusted data
  - no network/exec tools
  - tool outputs limited to project files, with a max number of files and bytes per proposal
  - the user always has to accept before anything changes
- Metering records tokens and cost (from a price table in `models.ts`) per request into UsageCounter, with structured log lines.

### 6. Billing (Stripe test mode)
- `billing/provider.ts` defines the `BillingProvider` interface (`createCheckout`, `createPortal`, `parseWebhook`); `stripe.provider.ts` implements it.
- Routes:
  - `POST /api/v1/billing/checkout` (Checkout Session, subscription mode, monthly/yearly)
  - `POST /billing/portal` (Customer Portal: cancel, change card, invoices)
  - `GET /billing/subscription`
- `/webhooks/stripe` uses the raw body with a signature check, and handles `checkout.session.completed`, `customer.subscription.created|updated|deleted` and `invoice.payment_failed`. It is idempotent via ProcessedWebhook and updates Subscription + `User.plan`.
- Entitlements always come from the stored subscription status (active/trialing → pro; past_due → grace banner; canceled → free at period end). The Checkout success page never grants anything.
- UI: Pricing page with a monthly/yearly toggle, a Billing tab in settings (plan, renewal date, usage bars, "Manage billing"), and contextual upgrade modals when a limit is hit. A banner notes that test mode is active and shows the `4242…` test card.

### 7. UI/UX
- Design system: shadcn/ui on Radix (accessible), Tailwind v4 tokens, dark and light themes, Geist/Inter + JetBrains Mono, `sonner` toasts, skeleton loaders, empty states, and optimistic updates via TanStack Query.
- Pages:
  - Landing (hero with product screenshot/GIF, features, pricing, FAQ, footer)
  - Sign in/up
  - Dashboard (project grid, search, recent, create-from-template modal)
  - Workspace
  - Settings (profile via Clerk, billing, usage)
  - Invite accept
  - 404/error boundaries
- Power features: ⌘K command palette (`cmdk`), keyboard shortcuts sheet, resizable/collapsible panels remembered per user.
- Responsive: the workspace degrades on mobile to chat + read-only file view; everything else is fully responsive.
- Onboarding: a first-run template project and a short tour.

### 8. Platform best practices
- **Validation:** `env.ts` validates env vars with Zod and fails fast; every request, socket payload and AI tool call is validated with shared Zod schemas.
- **Security:**
  - helmet with CSP
  - CORS allowlist
  - body size limits
  - global IP rate limit + per-route limits
  - no secrets in the repo (`.env.example` only; stop committing `.env.local`)
- **Logging and monitoring:**
  - structured logs (pino + requestId; the legacy swap to morgan was for dev readability, so use `pino-pretty` in dev)
  - Sentry free tier on frontend and backend
  - `/health` + `/ready` (checks Mongo/Redis)
- **Tests:**
  - Vitest unit tests for services, guard and plan logic
  - Supertest + `mongodb-memory-server` for REST and webhooks (Stripe signature fixtures)
  - socket integration tests
  - Playwright e2e: sign-in (Clerk testing tokens), create project, co-edit in two browser contexts, AI proposal accept (mocked provider), upgrade via Stripe test checkout
- **CI:** GitHub Actions runs install → lint (ESLint flat + Prettier) → typecheck → test → build on each PR.
- **Docs:** README (architecture diagram, screenshots, local setup, env table, Stripe CLI webhook instructions), AGENTS.md updated.

## Delivery phases (each ends deployable)

0. **Foundation:**
   - `git mv` old code to `legacy/`, on branch `v2`
   - npm workspaces, TS configs, lint/prettier, `shared` package, env validation
   - Clerk sign-in end to end, user webhook sync
   - CI; skeleton deployed to Vercel + Render
1. **Projects & roles:** models, REST, invites, `requireProjectRole`, dashboard UI, plan limits (Free defaults).
2. **Workspace + co-editing:** file model, Hocuspocus, CodeMirror collab, presence, file tree, WebContainer run/preview ported.
3. **Chat:** persistence, threads, reactions, mentions, unread, typing, rate limits.
4. **AI gateway:** providers + failover, streaming to room, tool-based proposals + diff accept, guard, metering, usage UI.
5. **Billing:** Stripe provider, checkout/portal/webhooks, entitlements, pricing + billing UI, upgrade prompts.
6. **Polish & launch:** landing page, onboarding, a11y/responsive pass, Sentry, Playwright suite, README/screenshots, final deploy, then retire `legacy/` once v2 has fully replaced it.

Next process step after approval:
1. Save this design as a spec at `docs/superpowers/specs/2026-09-18-codecollab-v2-design.md` (commit on branch `v2`).
2. Produce a detailed per-phase implementation plan (writing-plans).
3. Execute phase by phase, with review checkpoints.

## Accounts / keys the user will need (all free)
Clerk (publishable + secret key, webhook secret), Stripe test mode (secret key, 2 price IDs, webhook secret; Stripe CLI for local webhooks), MongoDB Atlas, Upstash Redis, Google AI Studio key (Anthropic/OpenAI keys optional), Sentry (optional), Vercel + Render accounts.

## Verification
- `npm run lint && npm run typecheck && npm test` at the root, all passing in CI.
- Local: `npm run dev` starts frontend (5173) + backend (3000); `stripe listen --forward-to localhost:3000/webhooks/stripe`.
- Manual end to end:
  1. Sign up and verify email, create a project, open an invite link in a second browser, confirm live cursors and simultaneous edits converge, reload, and confirm files and chat persist.
  2. Ask `@ai` for a change, watch it stream in both browsers, accept the diff, and confirm both editors update.
  3. Hit the Free AI quota, get the upgrade modal, pay with `4242 4242 4242 4242`, receive the webhook, see the plan become Pro and the limits rise; cancel in the Portal and confirm the downgrade at period end.
- Security checks:
  - a non-member socket/REST access to a project gets 403
  - a spoofed `authorId` is ignored
  - an AI tool path `../../etc` is rejected
  - rapid AI spam gets 429
  - a replayed Stripe webhook is a no-op
- Playwright suite covers the flows above against the deployed preview.
