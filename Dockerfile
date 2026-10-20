# Imágenes de producción de Sentinel. Se construyen desde la raíz del repositorio:
#   docker build --target api    -t sentinel-api .
#   docker build --target worker -t sentinel-worker .
#   docker build --target web    -t sentinel-web .      # Caddy con la web estática dentro
# Funcionan en amd64 y arm64 (las VM gratuitas de Oracle son ARM).

ARG NODE_VERSION=22

# ---------- Manifiestos: pnpm y los package.json del workspace ----------
# Mientras no cambien las dependencias, las capas que cuelgan de esta quedan en caché.
FROM node:${NODE_VERSION}-bookworm-slim AS manifests
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/cli/package.json packages/cli/
COPY packages/sdk-core/package.json packages/sdk-core/
COPY packages/sdk-browser/package.json packages/sdk-browser/
COPY packages/sdk-react/package.json packages/sdk-react/
COPY packages/sdk-node/package.json packages/sdk-node/
COPY packages/sdk-react-native/package.json packages/sdk-react-native/
COPY packages/sdk-python/package.json packages/sdk-python/
COPY tests/e2e/package.json tests/e2e/

# ---------- Compilación del monorepo ----------
FROM manifests AS build
RUN pnpm install --frozen-lockfile \
	--filter "@sentinel/api..." --filter "@sentinel/worker..." --filter "@sentinel/web..." \
	--filter "@argus-isolator/browser..." --filter "@argus-isolator/react..." --filter "@argus-isolator/node..." \
	--filter "@argus-isolator/react-native..." --filter "@argus-isolator/cli..."
COPY . .
RUN pnpm exec turbo run build \
	--filter=@sentinel/api --filter=@sentinel/worker --filter=@sentinel/web \
	--filter=@argus-isolator/browser --filter=@argus-isolator/react --filter=@argus-isolator/node \
	--filter=@argus-isolator/react-native --filter=@argus-isolator/cli
# Las SDK instalables que la propia instancia ofrece en /sdk/ (ver scripts/pack-sdks.sh).
RUN ./scripts/pack-sdks.sh /repo/sdk-dist

# ---------- Dependencias de producción de la API y el worker ----------
# (`pnpm deploy` no sirve aquí: intenta resolver también las dependencias de pares de las SDK.)
FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod \
	--filter "@sentinel/api..." --filter "@sentinel/worker..."

# ---------- Base de ejecución: API y worker comparten árbol, cada uno arranca el suyo ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /repo/apps/worker/node_modules apps/worker/node_modules
COPY --from=prod-deps /repo/packages/db/node_modules packages/db/node_modules
COPY --from=prod-deps /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /repo/packages/shared/package.json /repo/packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/db/package.json /repo/packages/db/
COPY --from=build /repo/packages/db/dist packages/db/dist
COPY --from=build /repo/packages/db/drizzle packages/db/drizzle
COPY --from=build /repo/apps/api/package.json /repo/apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/worker/package.json /repo/apps/worker/
COPY --from=build /repo/apps/worker/dist apps/worker/dist
USER node

# ---------- API ----------
FROM runtime AS api
WORKDIR /repo/apps/api
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
	CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.API_PORT||3000}/api/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

# ---------- Worker ----------
FROM runtime AS worker
WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]

# ---------- Web estática + Caddy (HTTPS y proxy hacia la API) ----------
FROM caddy:2-alpine AS web
COPY --from=build /repo/apps/web/dist /srv
COPY --from=build /repo/sdk-dist /srv/sdk
COPY deploy/Caddyfile /etc/caddy/Caddyfile
