# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

# Toolchain for the one native module (better-sqlite3), in case no prebuilt binary fits.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm \
	PATH=/pnpm:$PATH \
	npm_config_nodedir=/usr/local \
	CI=true
RUN corepack enable

WORKDIR /src

# Dependencies first, so code changes don't reinstall them.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY app/package.json app/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/stats-sdk/package.json packages/stats-sdk/
COPY packages/style/package.json packages/style/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# The server bundle contains everything except better-sqlite3; install just that.
RUN mkdir /runtime \
	&& cd /runtime \
	&& echo '{"type":"module","private":true}' > package.json \
	&& version="$(node -p "require('/src/app/package.json').dependencies['better-sqlite3']")" \
	&& npm install --omit=dev --no-audit --no-fund "better-sqlite3@${version}"

# ── Run ──────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	TREASURE_CONFIG=/app/config.yml \
	TREASURE_STYLE=/app/style.yml \
	TREASURE_STYLE_DEFAULT=/app/defaults/style.yml \
	TREASURE_DATA=/app/data \
	TREASURE_MIGRATIONS=/app/migrations

WORKDIR /app
COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /src/app/build ./build
COPY --from=build /src/packages/db/migrations ./migrations
COPY --from=build /src/style.yml ./defaults/style.yml
COPY --from=build /src/style.yml ./style.yml
COPY --from=build /src/config.example.yml ./config.example.yml

RUN mkdir -p /app/data /app/drive && chown -R node:node /app/data /app/drive
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "build"]
