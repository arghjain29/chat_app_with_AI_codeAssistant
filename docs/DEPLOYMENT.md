# Deploying CodeCollab

Two services, both on free tiers:

| Part                        | Host                        | Config in this repo             |
| --------------------------- | --------------------------- | ------------------------------- |
| Web app (`frontend/`)       | Vercel (static SPA)         | `vercel.json` (repo root)       |
| API + collaboration sockets | Render (one Node.js server) | `render.yaml` (repo root)       |
| Database                    | MongoDB Atlas free cluster  | `MONGO_URI`                     |
| Redis (optional)            | any provider                | `REDIS_URL` or `REDIS_HOST/...` |

The API and the Yjs collaboration socket are the same Node process, so there is nothing extra
to deploy for live editing.

> **Chicken and egg:** the API needs the web app's URL (`FRONTEND_URL`) and the web app needs the
> API's URL (`VITE_API_URL`). Deploy the API first with a placeholder, then come back and fix it
> in step 5. Both services redeploy in a minute.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster.
2. **Database Access:** add a user with a long generated password.
3. **Network Access:** Render's free plan has no fixed outbound IP, so allow `0.0.0.0/0`. The
   database is still protected by the user password — keep it long and unique, and never commit it.
4. Copy the connection string and add the database name:
   `mongodb+srv://user:password@cluster.mongodb.net/codecollab?retryWrites=true&w=majority`

## 2. Redis (optional, skip it the first time)

Without Redis the app runs fine: rate limits and caches fall back to in-memory counters, which is
correct for a single server. If you add one later, set `REDIS_URL` (use `rediss://` for TLS) or the
`REDIS_HOST` / `REDIS_PORT` / `REDIS_USERNAME` / `REDIS_PASSWORD` / `REDIS_TLS` values from the
provider's dashboard.

## 3. API on Render

1. **New → Blueprint**, pick this repository. Render reads `render.yaml` and creates a web service
   called `codecollab-api`.
2. It will ask for every secret marked `sync: false`. Fill in:

   | Variable                                              | Value                                                                  |
   | ----------------------------------------------------- | ---------------------------------------------------------------------- |
   | `FRONTEND_URL`                                        | `https://example.vercel.app` for now — corrected in step 5             |
   | `MONGO_URI`                                           | from step 1                                                            |
   | `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`          | Clerk dashboard → API keys                                             |
   | `CLERK_WEBHOOK_SIGNING_SECRET`                        | leave blank for now — set in step 6                                    |
   | `GEMINI_API_KEY`                                      | [aistudio.google.com/apikey](https://aistudio.google.com/apikey), free |
   | `ANTHROPIC_API_KEY`                                   | optional second provider                                               |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`             | Razorpay test keys                                                     |
   | `RAZORPAY_WEBHOOK_SECRET`                             | leave blank for now — set in step 7                                    |

   Leaving a key blank is a supported state: without Razorpay keys billing switches off and
   everyone stays on Free; without an AI key `@ai` replies that it isn't configured.

3. Deploy, then open `https://<your-api>.onrender.com/health` — it should return
   `{"status":"ok"}`. `/ready` additionally checks MongoDB (and Redis if configured).

**Free plan behaviour:** the service sleeps after ~15 minutes without traffic, and the next request
takes up to a minute to wake it. The web app's reconnect logic handles this, but the first page
load after idle feels slow. That's the free tier, not a bug.

## 4. Web app on Vercel

1. **Add New → Project**, import this repository.
2. **Root Directory: leave it at the repository root** (`./`). The build config lives in the root
   `vercel.json`, which installs the whole npm workspace and builds only `frontend`. Pointing
   Vercel at `frontend/` instead would ignore that file — and with it the COOP/COEP headers that
   WebContainer needs.
3. Environment variables (Production, and Preview if you use it):

   | Variable                      | Value                                       |
   | ----------------------------- | ------------------------------------------- |
   | `VITE_API_URL`                | `https://<your-api>.onrender.com` (no slash) |
   | `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk publishable key (`pk_…`)              |

   The collaboration socket URL is derived from `VITE_API_URL`, so `https://…` becomes `wss://…`
   automatically. There is nothing else to set.

4. Deploy, and note the domain (e.g. `https://codecollab.vercel.app`).

## 5. Point the API back at the web app

On Render, set `FRONTEND_URL` to the Vercel domain and redeploy. It is both the CORS allowlist and
the WebSocket origin check, so this is what stops the browser console filling with CORS errors.

Several origins are allowed, comma-separated — useful if you add a custom domain:
`https://codecollab.vercel.app,https://codecollab.dev`. Vercel preview deployments get a new
domain each time, so they won't be allowed unless you add them.

## 6. Clerk

1. **Allowed origins / domains:** add the Vercel domain so Clerk issues tokens for it.
2. **Webhooks → Add endpoint:** `https://<your-api>.onrender.com/webhooks/clerk`, subscribe to the
   `user.*` events, copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET` on Render.
   The webhook keeps profile changes and account deletions in sync; users are also created on their
   first API request, so a missing webhook degrades gracefully.
3. **Which keys:** a Clerk *production* instance needs your own domain with DNS records. On a free
   `*.vercel.app` domain, keep using the development instance keys (`pk_test_…` / `sk_test_…`) —
   that is the normal setup for a portfolio deployment, and the sign-in flow is identical.

## 7. Razorpay

1. **Account & Settings → Webhooks → Add**: `https://<your-api>.onrender.com/webhooks/razorpay`.
2. Tick `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled` and
   `refund.processed` (so a refund made in the dashboard also takes back the Pro it bought).
   Not `refund.created`: a refund can still fail after it's created.
3. Set a secret of your choosing and put the same value in `RAZORPAY_WEBHOOK_SECRET` on Render.
4. Keep the dashboard in **Test Mode**. Real money never moves, and the app labels itself as test
   mode wherever it takes a payment.

If the webhook is ever misconfigured, payments still land: when someone returns from paying, the
server asks Razorpay directly (`POST /api/v1/billing/check`). The webhook is the fast path, not the
only one.

## 8. Smoke test after deploying

1. `GET /health` → ok, `GET /ready` → `{"mongo":true,...}`.
2. Sign up, create a project, add a file.
3. Open the same file in a second browser (or an incognito window with a second account invited
   through a share link): typing in one shows a live cursor in the other.
4. Run a Node project. If the terminal reports that cross-origin isolation is missing, the COOP/COEP
   headers aren't being served — check that Vercel's Root Directory is the repo root (step 4.2). In
   DevTools → Network, the document response should show
   `cross-origin-opener-policy: same-origin`.
5. Mention `@ai` in chat and watch the answer stream.
6. Upgrade to Pro with a Razorpay [test card](https://razorpay.com/docs/payments/payments/test-card-details/)
   and confirm the billing page shows "Pro until …".

## Troubleshooting

| Symptom                                       | Cause                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "blocked by CORS policy" in the console       | `FRONTEND_URL` on Render doesn't exactly match the site's origin (scheme, no trailing slash).      |
| Editor connects, then drops repeatedly        | The API is asleep or restarting. Check Render logs; the first wake-up takes up to a minute.       |
| "SharedArrayBuffer is not defined" when running a project | COOP/COEP headers missing — see step 8.4.                                                         |
| Every API call returns 401                    | The Clerk keys on Render and in the web app belong to different instances, or the domain isn't in Clerk's allowed origins. |
| Payment succeeds but the plan stays Free      | Webhook URL, events or secret wrong. Open Billing; the app re-checks with Razorpay and fixes itself. |
| Webhook deliveries show 400 in the dashboard  | The secret on Render differs from the one in the provider's dashboard.                            |
