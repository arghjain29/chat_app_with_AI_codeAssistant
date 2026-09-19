# CodeCollab

A collaborative code workspace: a shared editor with live cursors, persistent team chat, and an AI pair-programmer everyone in the project can see. Free and Pro plans with Stripe subscriptions (test mode).

> **Status:** v2 rebuild in progress on the `v2` branch. The original v1 app lives in [`legacy/`](legacy/) for reference. The full design is in [`docs/superpowers/specs/2026-09-18-codecollab-v2-design.md`](docs/superpowers/specs/2026-09-18-codecollab-v2-design.md).

## Roadmap

| Phase | Scope                                                                            | Status |
| ----- | -------------------------------------------------------------------------------- | ------ |
| 0     | Foundation: TypeScript workspace, Clerk auth, API skeleton, CI                   | Done   |
| 1     | Projects, roles (owner/editor/viewer), invite links, plan limits                 | Done   |
| 2     | Workspace: file tree, live co-editing (Yjs), in-browser run & preview            | Done   |
| 3     | Persistent chat: threads, reactions, mentions, unread                            | Done   |
| 4     | AI gateway: multi-provider, streaming, diff proposals, quotas & abuse protection | Done   |
| 5     | Billing: Stripe Checkout, Customer Portal, webhooks, entitlements                | Done   |
| 6     | Polish: landing page, onboarding, Sentry, Playwright e2e, deploy                 | Next   |

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

## Payments (Stripe, test mode)

Free and Pro plans (`shared/src/plans.ts`). Upgrading goes through Stripe Checkout; card changes, invoices and cancellation go through the Stripe customer portal. The plan only changes when a **verified Stripe webhook** says so: the success page never grants anything by itself.

1. Create a free Stripe account, stay in **test mode**, and copy the secret key into `backend/.env` as `STRIPE_SECRET_KEY` (`sk_test_…`).
2. Create the Pro product and prices once: `npm run stripe:setup -w backend` (safe to re-run; refuses live keys).
3. Forward webhooks while developing with the [Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:3000/webhooks/stripe`, and put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`. In production, add an endpoint in the Stripe dashboard for `checkout.session.completed` and `customer.subscription.*`.
4. In the Stripe dashboard, turn on the customer portal (Settings → Billing → Customer portal).
5. Pay with the test card `4242 4242 4242 4242`, any future date and any CVC.

Webhook deliveries are verified, processed once (retries are ignored), and always re-read the subscription from Stripe so late or out-of-order events can't leave a stale plan. `past_due` keeps Pro during payment retries; cancellation takes effect at the end of the paid period. Deleting an account cancels its subscription. Billing sits behind a small `BillingProvider` interface (`backend/src/modules/billing/provider.ts`) so another provider, such as Razorpay, can be added.

## API conventions

- All endpoints live under `/api/v1` and authenticate with a Clerk session token (`Authorization: Bearer …`).
- Errors always have the shape `{ "error": { "code", "message", "requestId", "details?" } }`. Codes are listed in `shared/src/errors.ts`.
- Every response carries an `x-request-id` header, which is also written to the logs.
- `GET /health` reports liveness; `GET /ready` checks MongoDB and Redis.
