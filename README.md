# CodeCollab

A collaborative code workspace: a shared editor with live cursors, persistent team chat, and an AI pair-programmer everyone in the project can see. Free and Pro plans with Razorpay payments (test mode).

> **Status:** v2 rebuild in progress on the `v2` branch. The original v1 app lives in [`legacy/`](legacy/) for reference. The full design is in [`docs/superpowers/specs/2026-09-18-codecollab-v2-design.md`](docs/superpowers/specs/2026-09-18-codecollab-v2-design.md).

## Roadmap

| Phase | Scope                                                                            | Status |
| ----- | -------------------------------------------------------------------------------- | ------ |
| 0     | Foundation: TypeScript workspace, Clerk auth, API skeleton, CI                   | Done   |
| 1     | Projects, roles (owner/editor/viewer), invite links, plan limits                 | Done   |
| 2     | Workspace: file tree, live co-editing (Yjs), in-browser run & preview            | Done   |
| 3     | Persistent chat: threads, reactions, mentions, unread                            | Done   |
| 4     | AI gateway: multi-provider, streaming, diff proposals, quotas & abuse protection | Done   |
| 5     | Billing: Razorpay payments, verified webhooks, prepaid Pro passes, entitlements  | Done   |
| 6     | Polish: landing page, onboarding, Sentry, Playwright e2e, deploy                 | Next   |

## Stack

- **frontend/**: React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Radix UI, Clerk
- **backend/**: Node 22+, Express 5, Mongoose (MongoDB), ioredis (optional), pino, Clerk, Zod
- **shared/**: Zod schemas, types, plan limits and error codes used by both apps

It is one git repo with three npm workspaces. The web app deploys to Vercel and the API to Render, both from the repository root (`vercel.json` and `render.yaml`). Step-by-step instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

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

## Running projects in the browser

Projects run inside [WebContainer](https://webcontainers.io) (Node.js in the browser), on each person's own machine. What **Run** does depends on the files:

| Project has                                   | Run does                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| `package.json` with a `dev` or `start` script | `npm install`, then that script, with a live preview |
| `index.html` (no `package.json`)              | Serves the files as a static site                    |
| `index.js` / `main.js` / `server.js`          | `node <file>` in the terminal                        |
| Anything else (Python, Java, Go, …)           | Edit-only: code can be edited together, but not run  |

WebContainer needs a cross-origin isolated page (`COOP: same-origin`, `COEP: credentialless`, set in `vite.config.ts` and `vercel.json`) and works in Chrome, Edge and Firefox. WebContainer is free for personal, open-source and prototype use; commercial production use needs a [StackBlitz license](https://webcontainers.io/enterprise).

## Real-time collaboration

Each file is a Yjs document served by Hocuspocus at `ws(s)://<api>/collab`, on the same server as the API. Connections authenticate with the Clerk session token; viewers connect read-only. Edits are saved to MongoDB about 2 seconds after typing stops (at most every 10 seconds while typing continues).

## AI assistant

Mention `@ai` in a project's chat. The answer streams to everyone in the project, and code changes arrive as a suggested diff that an editor accepts or dismisses; accepted changes go through the live documents, so open editors update immediately.

- **Providers:** Gemini (`GEMINI_API_KEY`, the free tier is enough) and optionally Claude (`ANTHROPIC_API_KEY`), called through their official SDKs. Each plan tier has an ordered fallback list (`AI_FAST_MODELS`, `AI_PREMIUM_MODELS`); models without a key are skipped, and the next model is tried if one is unavailable before it starts answering.
- **Limits:** per-plan quotas (Free: 30 requests/day, Pro: 1,500/month), a per-minute rate limit, one answer at a time per person, and a daily spending ceiling for the whole app (`AI_DAILY_BUDGET_USD`). Viewers can't ask the AI. Requests that produce nothing are refunded.
- **Safety:** project files and chat are passed as delimited, untrusted data; suggested paths are validated like any file path; nothing changes until a person accepts; and a suggestion is refused if a file changed after the AI read it.

## Payments (Razorpay, test mode)

Pro is a **prepaid pass**: one payment buys one period (`shared/src/plans.ts`: ₹799 for a month or ₹7,990 for a year), and Pro runs until that date. Nothing auto-renews, so there is nothing to cancel — the account goes back to Free by itself when the pass runs out, and extending early adds to the time that's left. This uses Razorpay **Payment Links**, which every account has; Subscriptions are gated for new accounts.

The plan changes only when Razorpay says the payment happened, never because the browser says so. Two paths report it: a **verified webhook** (`payment_link.paid`), and, when someone returns from paying, the server reading the payment page back from Razorpay's API (`POST /api/v1/billing/check`). Either one is enough, and each payment is applied once, so a local server with no webhook tunnel still works.

1. Sign up at [razorpay.com](https://razorpay.com), switch the dashboard to **Test Mode**, and generate test API keys (**Account & Settings → API Keys**). Put them in `backend/.env` as `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET`.
2. Add a webhook (**Account & Settings → Webhooks**) pointing at `https://<your-api>/webhooks/razorpay` with the `payment_link.paid`, `payment_link.expired` and `payment_link.cancelled` events, choose a secret, and put it in `RAZORPAY_WEBHOOK_SECRET`. Razorpay can't reach `localhost`, so in development expose the API with a tunnel, for example `cloudflared tunnel --url http://localhost:3000`.
3. Pay with one of Razorpay's [test cards](https://razorpay.com/docs/payments/payments/test-card-details/). The hosted page always asks for a phone number; any 10-digit number works in test mode.
4. UPI (including the test ID `success@razorpay`) only appears if UPI is enabled for the account under **Account & Settings → Payment Methods**, which usually needs a completed KYC. Cards and netbanking work without it.

Without keys, billing is switched off and everyone stays on Free. Webhook deliveries are verified (HMAC-SHA256) and processed once per `x-razorpay-event-id`, and each payment extends Pro only once. Deleting an account closes any unpaid payment page. Billing sits behind a small `BillingProvider` interface (`backend/src/modules/billing/provider.ts`).

## API conventions

- All endpoints live under `/api/v1` and authenticate with a Clerk session token (`Authorization: Bearer …`).
- Errors always have the shape `{ "error": { "code", "message", "requestId", "details?" } }`. Codes are listed in `shared/src/errors.ts`.
- Every response carries an `x-request-id` header, which is also written to the logs.
- `GET /health` reports liveness; `GET /ready` checks MongoDB and Redis.
