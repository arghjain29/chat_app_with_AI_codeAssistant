# syntax=docker/dockerfile:1
#
# The API image. Build it from the repository root, not from backend/:
#   docker build -f backend/Dockerfile -t codecollab-api .
# The build needs the root lockfile and the shared package, so the whole workspace
# is the context.

# ---- Build the bundle -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /repo

# Package manifests first: this layer is cached until a dependency changes.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
# tsup and TypeScript are devDependencies, so the build needs them even here.
RUN npm ci --include=dev --workspace backend --include-workspace-root

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
RUN npm run build -w backend

# ---- Production dependencies only -------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN npm ci --omit=dev --workspace backend --include-workspace-root \
  && npm cache clean --force

# ---- Run it -----------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
# Node reads "type": "module" from here to run the bundle as ESM.
COPY --from=build /repo/backend/package.json ./package.json

# `node` (uid 1000) ships with the image; nothing here needs to write to disk.
USER node
EXPOSE 3000

# /health is the cheap check: it says the process is up without touching Mongo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
