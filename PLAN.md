# Sentinel — Plan del proyecto

Sistema de tracking de errores y performance estilo Sentry. Objetivo: aprendizaje + portfolio, con opción a producto real.

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Objetivo | Aprendizaje / portfolio, potencial producto |
| Tenancy | Multiusuario y multi-organización desde el inicio |
| Primera plataforma | Frontend web (JS/React). Luego Node, React Native, Python |
| Source maps | Sí, en Fase 2 (ver §3) |
| Alertas | Email + webhook, configurables por organización/proyecto |
| Alcance | Errores primero, luego performance/tracing |
| Auth de usuarios | Email/password + Google OAuth. Tokens de API para CLI/CI |
| Retención | Sin límite al inicio; diseñado para añadir retención configurable |
| Idiomas UI | Español e inglés (i18n desde el día 1) |
| Volumen | Bajo/medio (portfolio): Postgres como almacén de datos + Redis para colas |

## 2. Stack propuesto

Un solo lenguaje (TypeScript) en todo el repo, alineado con tu experiencia en React.

- **Monorepo:** pnpm workspaces + Turborepo.
- **API (`apps/api`):** NestJS (con el adaptador de Fastify como servidor HTTP, para mantener buen rendimiento en la ingesta) + Zod para validación (vía `nestjs-zod`), de modo que los esquemas se compartan con el SDK y el frontend desde `packages/shared`. Módulos por dominio: `auth`, `organizations`, `projects`, `ingest`, `issues`, `alerts`, `releases`.
- **Worker (`apps/worker`):** aplicación NestJS independiente (standalone, sin HTTP) que reutiliza los módulos de dominio y procesa eventos en segundo plano con **BullMQ** (`@nestjs/bullmq`) sobre **Redis**. Redis también se usa para rate limiting y caché.
- **Base de datos:** PostgreSQL. ORM: Drizzle. Eventos en JSONB, tablas de eventos/spans particionadas por fecha para poder borrar por retención con facilidad.
- **Frontend (`apps/web`):** SPA independiente dentro del monorepo, que consume la API por HTTP (ver §2.1). React + Vite + TypeScript, TanStack Router y Query, Tailwind + shadcn/ui, Recharts para gráficos, i18next para idiomas.
- **SDK (`packages/sdk-browser`, luego `sdk-react`, `sdk-node`, `sdk-react-native`):** TypeScript, sin dependencias, con envío vía `fetch` y `sendBeacon`.
- **Auth:** Better Auth (decidido) con su plugin `organization`, que aporta organizaciones, membresías con roles e invitaciones. Adaptador de Drizzle sobre Postgres.
- **Email:** Resend (plan gratuito) o SMTP genérico. Webhooks firmados con HMAC.
- **Tests:** Vitest; Playwright para el flujo E2E principal.

**Escalado futuro:** el acceso a eventos queda detrás de una interfaz (`EventStore`). Si algún día hace falta, se cambia Postgres por ClickHouse sin tocar el resto.

### 2.1 Estructura del monorepo

```
sentinel/
├── apps/
│   ├── api/       # NestJS (HTTP)
│   ├── worker/    # NestJS standalone (BullMQ)
│   └── web/       # React + Vite (SPA)
├── packages/
│   ├── shared/    # esquemas Zod, tipos, constantes (usado por api, web y sdk)
│   ├── sdk-browser/
│   └── cli/       # sentinel-cli (subida de source maps)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

El frontend es una app aparte, no se sirve desde NestJS: en desarrollo corre con Vite (hot reload) y llama a la API; en producción se compila a archivos estáticos (servidos por CDN o Caddy). Comparte tipos y esquemas con la API desde `packages/shared`. Autenticación por cookie de sesión (`httpOnly`), con CORS restringido al dominio del dashboard.

## 3. Cómo funciona (resumen)

```
SDK ──POST──► /ingest (valida DSN, rate limit) ──► cola ──► worker
                                                              │ source maps → stack legible
                                                              │ fingerprint → agrupar en Issue
                                                              │ actualizar contadores
                                                              └ disparar alertas
                                    UI ◄── API ◄── Postgres
```

**Source maps:** en producción el JS está minificado (`a.js:1:3482`). Un source map permite traducirlo a `checkout.ts:57`. Sin esto los errores de un frontend real son casi ilegibles, por eso van en la Fase 2. Se suben por release vía CLI (`sentinel-cli upload-sourcemaps`) usando un token de API.

**Agrupación:** fingerprint = hash(tipo de error + frames "in-app" normalizados + mensaje sin valores variables). Permite reglas personalizadas más adelante.

## 4. Modelo de datos (inicial)

- `users`, `sessions`, `accounts` (OAuth)
- `organizations`, `memberships` (rol: owner / admin / member), `invitations`
- `projects` (org, nombre, plataforma), `project_keys` (DSN pública, activa/revocada)
- `releases` (proyecto, versión), `source_maps` (release, archivo, blob)
- `issues` (proyecto, fingerprint, título, estado, first/last seen, contadores, asignado a)
- `events` (issue, timestamp, payload JSONB, release, environment, usuario final)
- `alert_rules` (proyecto, condición, canales), `alert_channels` (email/webhook), `alert_deliveries`
- `api_tokens` (org, scopes)
- Fase 4: `transactions`, `spans`

## 5. API

- **Ingesta (pública, por DSN):** `POST /api/:projectId/events`, y luego `/transactions`. Responde 202 al instante. Límites de tamaño, rate limit por proyecto, CORS abierto solo aquí.
- **API de producto (sesión):** auth, organizaciones, miembros, proyectos, issues (lista, detalle, cambiar estado, asignar, comentar), eventos, releases, alertas.
- **API para CLI (token):** subida de source maps.

## 6. Roadmap por fases

**Fase 0 — Fundaciones**
Monorepo, Docker Compose (Postgres + Redis), lint/format/CI, migraciones, estructura base de api/web/sdk.

**Fase 1 — Núcleo de errores (MVP)**
Auth (email/password + Google), organizaciones y miembros, proyectos y DSN, endpoint de ingesta, cola + worker, agrupación en issues, SDK browser (captura global, `captureException`, contexto básico, breadcrumbs), UI: lista de issues, detalle con stack trace, estados resolved/ignored. App demo que genere errores.

**Fase 2 — Hacerlo útil de verdad**
Source maps + CLI, releases y environments, detección de regresiones, búsqueda y filtros, SDK React (ErrorBoundary), i18n completo, scrubbing de datos sensibles.

**Fase 3 — Alertas y colaboración**
Reglas de alerta (nuevo issue, regresión, umbral de frecuencia), canales email + webhook, asignación, comentarios, invitaciones por email, tokens de API.

**Fase 4 — Performance / tracing**
Transacciones y spans en el SDK, tabla de transacciones, percentiles (p50/p95), vista de cascada de spans, Web Vitals.

**Fase 5 — Más plataformas y pulido**
SDK Node, React Native, Python. Retención configurable, cuotas, dashboard de estadísticas, documentación pública y landing de portfolio.

## 7. Despliegue (recomendación)

- **Desarrollo:** `docker compose up` (Postgres + Redis + api + worker + web). Esto es también el self-hosting.
- **Producción barata/gratis para portfolio:**
  - *Opción A (recomendada):* una VM gratuita (Oracle Cloud "Always Free") con Docker Compose y Caddy para HTTPS. Es la única que da recursos reales sin costo, pero requiere más configuración.
  - *Opción B (más fácil):* web en Cloudflare Pages/Vercel + API y worker en Render/Railway/Fly + Postgres en Neon o Supabase. Los planes gratuitos cambian a menudo y suelen tener límites (suspensión por inactividad, expiración de DB); hay que verificarlos al momento de desplegar.
- Se decide recién al terminar la Fase 1; no condiciona el desarrollo.

## 8. Riesgos y mitigaciones

- **Endpoint público:** rate limiting, límite de tamaño de payload, validación estricta, descartar eventos de proyectos inactivos.
- **Datos sensibles (PII):** scrubbing en el SDK y en el servidor (contraseñas, tokens, tarjetas).
- **Tormentas de eventos:** rate limit y sampling por proyecto; deduplicación rápida por fingerprint.
- **Agrupación incorrecta:** tests con casos reales de stack traces; reglas de fingerprint ajustables.
- **Multi-tenancy:** toda consulta filtrada por organización; tests de aislamiento entre organizaciones.
- **Alcance excesivo:** se avanza por fases y cada una debe quedar usable antes de pasar a la siguiente.

## 9. Pendientes por definir

1. Nombre final y dominio (por ahora "Sentinel").
2. Proveedor de despliegue (después de la Fase 1).
3. Licencia del repo (MIT / AGPL / privado).
4. Diseño visual: referencias y paleta.
