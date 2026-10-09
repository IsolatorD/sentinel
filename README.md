# Sentinel

Sistema de tracking de errores y performance estilo Sentry. Ver [PLAN.md](PLAN.md).

## Requisitos

Node 24 (`nvm use`), pnpm 10, Docker.

## Desarrollo

```bash
cp .env.example .env
pnpm install
pnpm infra:up     # Postgres + Redis
pnpm db:migrate   # aplica las migraciones
pnpm dev          # api (3000), worker y web (5173)
```

## Estructura

- `apps/api` — NestJS (HTTP)
- `apps/worker` — NestJS standalone (BullMQ)
- `apps/web` — React + Vite
- `packages/sdk-browser` — SDK de navegador (`@sentinel/browser`)
- `examples/browser-demo` — página para probar el SDK en un navegador real
- `packages/db` — esquema Drizzle y migraciones (Postgres)
- `packages/shared` — esquemas Zod y tipos compartidos

## Base de datos

Esquema en `packages/db/src/schema`. Tras cambiarlo: `pnpm db:generate` (crea la migración en `packages/db/drizzle`) y `pnpm db:migrate`.

## Autenticación

[Better Auth](https://www.better-auth.com) con email/contraseña, Google y el plugin de organizaciones (roles owner/admin/member e invitaciones). Las rutas viven en `/api/auth/*`.

Variables en `.env`: `BETTER_AUTH_SECRET` (generar con `openssl rand -base64 32`) y, opcionalmente, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Para Google, la URI de redirección autorizada es `http://localhost:3000/api/auth/callback/google`. Sin esas credenciales, Google queda desactivado.

## API de proyectos

Requiere sesión. Todo cuelga de una organización; quien no es miembro recibe 404. Leer: cualquier miembro. Crear, editar y borrar: `owner` o `admin`.

| Método | Ruta (`/api/organizations/:orgId/projects`) | |
|---|---|---|
| GET / POST | `/` | listar / crear (crea también su primera clave) |
| GET / PATCH / DELETE | `/:projectId` | detalle con claves / renombrar / borrar |
| POST | `/:projectId/keys` | nueva clave DSN |
| PATCH / DELETE | `/:projectId/keys/:keyId` | revocar o renombrar / borrar |

La DSN tiene la forma `http://<clavePública>@host/<projectId>`; `PUBLIC_API_URL` (opcional) define el host que se muestra.

## Ingesta de eventos

`POST /api/:projectId/events` — público, lo llaman los SDK. Autenticación con la clave pública de la DSN, en el header `X-Sentinel-Key` o en `?sentinel_key=` (para `sendBeacon`). Responde `202 { id }` y encola el evento en BullMQ; el worker calcula el fingerprint, lo agrupa en un *issue* y guarda el evento.

- **Formato del evento:** esquema Zod en `packages/shared/src/ingest.ts` (excepción con stacktrace, mensaje, usuario, tags, breadcrumbs, etc.).
- **Agrupación:** `apps/worker/src/events/fingerprint.ts` (tipo + frames del código propio; ignora números de línea, host y hash del bundle). Un issue resuelto que vuelve a ocurrir se reabre.
- **Límites:** cuerpo máx. 1 MB, `INGEST_RATE_LIMIT_PER_MINUTE` eventos por proyecto (429 + `Retry-After`) y freno por IP a las claves inválidas.
- **CORS:** abierto solo en la ruta de ingesta; el resto de la API acepta solo `WEB_ORIGIN`.

Tests: `pnpm test` (hoy cubre el fingerprint).

## Arquitectura del backend

Monolito modular: un módulo de NestJS por feature y, dentro de cada uno, capas con dependencias en un solo sentido:

```
controller  →  service  →  repository  →  db
(HTTP)         (reglas)     (Drizzle)
```

- **controller:** valida la entrada (Zod), llama al service y responde. No contiene lógica.
- **service:** reglas de negocio y permisos. No conoce Drizzle.
- **repository:** la única capa que habla con la base de datos.
- **domain/:** funciones puras (slug, DSN, roles, fingerprint), probadas sin base de datos.
- Un módulo solo usa a otro a través de su service exportado, nunca leyendo sus tablas.
- En el worker, `EventRepository` es una interfaz: hoy la implementa Postgres y puede reemplazarse (p. ej. por ClickHouse) sin tocar la agrupación.

## Configuración, errores y logs

- **Entorno:** se valida con Zod al arrancar (`apps/*/src/config/env.ts`); si falta o es inválida una variable, el proceso falla con un mensaje claro. Ver `.env.example`.
- **Errores:** toda la API responde con el mismo formato `{ statusCode, code, message, issues?, requestId }`.
- **Logs:** JSON estructurado con `pino` (legible en desarrollo). Cada petición lleva un `x-request-id` (se respeta el entrante y se devuelve en la respuesta). Los headers sensibles y `sentinel_key` de la URL se redactan.
- **Documentación:** OpenAPI generado desde los mismos esquemas Zod. UI en `/api/docs`, JSON en `/api/docs/openapi.json` y la referencia de Better Auth en `/api/auth/reference`. Se desactiva en producción salvo `ENABLE_DOCS=true`.

## API de issues

Requiere sesión. Cuelga de un proyecto: `/api/organizations/:orgId/projects/:projectId/issues`. Cualquier miembro puede leer y cambiar el estado; borrar requiere `owner` o `admin`.

| Método | Ruta | |
|---|---|---|
| GET | `/` | lista paginada de issues |
| GET / PATCH / DELETE | `/:issueId` | detalle con el último evento / cambiar estado / borrar |
| GET | `/:issueId/events` | eventos del issue (resumen, más recientes primero) |
| GET | `/:issueId/events/:eventId` | evento completo (stacktrace, breadcrumbs, contexto) |

Parámetros del listado: `status` (`unresolved` por defecto, `resolved`, `ignored` o `all`), `level`, `q` (busca en título y culprit), `sort` (`lastSeen`, `firstSeen`, `events`), `order`, `limit` (máx. 100) y `offset`. Cada issue incluye `userCount` (usuarios distintos afectados). Un issue resuelto que vuelve a ocurrir se reabre solo; uno ignorado sigue ignorado.

## Pruebas

| Comando | Qué ejecuta | Necesita |
|---|---|---|
| `pnpm test` | Tests unitarios (reglas puras, servicios con repositorios falsos, SDK en jsdom) | nada |
| `pnpm test:e2e` | Pruebas de integración en `tests/e2e` | `pnpm infra:up` (Postgres y Redis) |

Las pruebas de integración compilan y **arrancan la API y el worker reales** (`dist/`), y los ejercitan por HTTP contra Postgres y Redis reales: autenticación, permisos por rol, aislamiento entre organizaciones, ingesta, agrupación, idempotencia, rate limiting, CORS, la API de issues y el SDK de navegador.

Son independientes de tu entorno de desarrollo: usan su propia base de datos (`sentinel_e2e`, que se recrea y se borra en cada corrida), el índice 15 de Redis y un puerto libre, así que se pueden correr con `pnpm dev` encendido. Si algo falla, los logs de la API y el worker quedan en `tests/e2e/.logs`. Variables opcionales: `E2E_POSTGRES_URL`, `E2E_REDIS_HOST`, `E2E_REDIS_PORT`, `E2E_REDIS_DB`.

En el CI corren como un job aparte con servicios de Postgres y Redis.
