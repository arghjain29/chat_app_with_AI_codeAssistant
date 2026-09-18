# AGENTS.md

## Layout

npm workspaces, TypeScript everywhere, ESM.

- `shared/`: Zod schemas, types, `PLANS` (plan limits), roles and error codes. It ships TS source (no build step); the backend bundles it via tsup `noExternal`.
- `backend/`: Express 5 API. Entry `src/server.ts`, app factory `src/app.ts`. Feature modules live in `src/modules/<feature>/` (`*.model.ts`, `*.service.ts`, `*.routes.ts`).
- `frontend/`: Vite + React 19. File-based routes in `src/routes/` (TanStack Router; `routeTree.gen.ts` is generated and gitignored). Feature code lives in `src/features/<feature>/`, UI primitives in `src/components/ui/`.
- `legacy/`: v1 JavaScript app, kept only as reference. Don't edit it; it's excluded from lint and format.
- The design spec is in `docs/superpowers/specs/`.

## Commands (repo root)

`npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format`.
Use `npm run` / `npm exec`. The global `npx` on the author's machine is broken.

## Conventions

- **Auth:** only `backend/src/lib/clerk.ts` imports Clerk. Routes use `requireUser` + `currentUser(req)`. Tests replace that module with a fake where the `x-test-user: <clerkId>` header signs a request in (`backend/test/setup.ts`).
- **Errors:** throw `AppError` subclasses from `backend/src/lib/errors.ts`. Zod errors become 400 automatically. Express 5 forwards async errors, so no wrapper is needed.
- **Validation:** parse inputs with shared Zod schemas (`parseBody`/`parseParams`/`parseQuery` in `middleware/validate.ts`).
- **Env:** add new variables to `backend/src/env.ts` (or `frontend/src/lib/env.ts`) and to the matching `.env.example`.
- **Plan limits:** read them from `PLANS` in `shared/src/plans.ts` and never hard-code them. The backend is the enforcement point.
- **Styling:** use the theme tokens in `frontend/src/index.css` (`bg-paper`, `text-ink`, `bg-cobalt`, …) and don't use raw colours. Presence colours (marigold/teal/rose) identify collaborators only.
- **Commits:** keep messages short and simple, with no AI/assistant attribution lines.
