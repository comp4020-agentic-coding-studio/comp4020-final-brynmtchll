# syntax = docker/dockerfile:1

# The app is plain Node: node:http serves it, node:sqlite stores it on the /data
# volume, and Node runs the TypeScript in src/ directly, so there's no build
# step. It serves HTTP on 0.0.0.0:$PORT (fly.toml sets PORT) and renders
# README.md at /readme/ (spec/README.md says what's checked).

FROM docker.io/library/node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY src/ src/
COPY README.md ./
ENV DATA_DIR=/data
CMD ["node", "src/server.ts"]
