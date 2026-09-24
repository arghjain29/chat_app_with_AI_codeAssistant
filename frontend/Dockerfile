# syntax=docker/dockerfile:1
#
# The web image: the built SPA served by nginx. Build from the repository root:
#   docker build -f frontend/Dockerfile --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_… -t codecollab-web .
#
# Vite replaces VITE_* values at BUILD time, so they are build arguments. An image
# built for one API URL cannot be pointed at another without rebuilding.

FROM node:22-alpine AS build
ARG VITE_API_URL=http://localhost:3000
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
WORKDIR /repo

# Fail now, with a clear reason, rather than in the browser after deploying.
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" \
  || (echo "VITE_CLERK_PUBLISHABLE_KEY build argument is required" && exit 1)

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN npm ci --include=dev --workspace frontend --include-workspace-root

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY frontend/ frontend/
RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1/healthz || exit 1
