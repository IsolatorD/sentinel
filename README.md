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
| `pnpm test` | Tests unitarios y de interfaz (reglas puras, servicios con repositorios falsos, SDK y frontend en jsdom) | nada |
| `pnpm test:e2e` | Pruebas de integración en `tests/e2e` | `pnpm infra:up` (Postgres y Redis) |

Las pruebas de integración compilan y **arrancan la API y el worker reales** (`dist/`), y los ejercitan por HTTP contra Postgres y Redis reales: autenticación, permisos por rol, aislamiento entre organizaciones, ingesta, agrupación, idempotencia, rate limiting, CORS, la API de issues y el SDK de navegador.

Son independientes de tu entorno de desarrollo: usan su propia base de datos (`sentinel_e2e`, que se recrea y se borra en cada corrida), el índice 15 de Redis y un puerto libre, así que se pueden correr con `pnpm dev` encendido. Si algo falla, los logs de la API y el worker quedan en `tests/e2e/.logs`. Variables opcionales: `E2E_POSTGRES_URL`, `E2E_REDIS_HOST`, `E2E_REDIS_PORT`, `E2E_REDIS_DB`.

En el CI corren como un job aparte con servicios de Postgres y Redis.

## Frontend (`apps/web`)

Interfaz web inspirada en Sentry: barra lateral violeta, listado de issues con filtros, y el detalle de cada error con su stack trace, breadcrumbs, tags y contexto. Español e inglés (se detecta el idioma del navegador y se cambia desde el menú de usuario).

```bash
pnpm dev                 # web en http://localhost:5173 (proxy de /api al backend)
pnpm seed:demo           # puebla una organización de demostración con 72 eventos
```

La semilla crea el usuario `demo@sentinel.dev` (contraseña `demo-password-123`, solo para desarrollo local). Variables opcionales del servidor de desarrollo: `VITE_API_TARGET` (por defecto `http://localhost:3000`) y `VITE_PORT`.

**Pantallas:** acceso y registro (email y Google si está configurado), onboarding guiado (organización → proyecto → instalación del SDK con la DSN), proyectos, issues, detalle de un issue (con navegación entre eventos) y configuración del proyecto (claves DSN, instalación, zona de peligro).

**Arquitectura** (atómica, ver `PLAN.md` §2.2): `components/{atoms,molecules,organisms,templates}`, `pages/`, `services/` (única capa que llama a la API, validando con los esquemas de `shared`) y `hooks/` (TanStack Query sobre los services). Ningún componente ni página importa un service; un test lo verifica en cada ejecución. El estado de la pantalla (filtros, página, pestaña, evento elegido) vive en la URL.

**Estructura de carpetas** (la verifica `architecture.test.ts`): cada componente, página, hook, service y util vive en su propia carpeta con su mismo nombre, y solo declara una cosa:

```
components/atoms/Button/
├── Button.tsx              # el componente
├── ButtonInterface.d.ts    # sus interfaces y tipos
└── Button.constants.ts     # constantes y helpers que no necesitan estar dentro (variantes, listas, funciones puras)
```

Los subcomponentes que solo usa su padre van anidados (`organisms/Sidebar/OrgSwitcher/`); los exportados y reutilizables, al lado de los demás. Las funciones de ayuda globales están en `utils/`. Los imports usan la ruta completa (`@/components/atoms/Button/Button`), sin `index.ts`. El cliente HTTP es axios (`services/http`).

Rutas: `/login`, `/register`, `/onboarding`, `/:org/projects`, `/:org/projects/:proyecto/issues`, `/:org/projects/:proyecto/issues/:issue`, `/:org/projects/:proyecto/settings`.

## Releases y regresiones

Las releases (versiones de tu app) se registran solas al llegar el primer evento con `release`. En la página **Releases** de cada proyecto se ve cuántos eventos y cuántos issues nuevos trajo cada una, y el listado de issues se puede filtrar por **entorno** y por **release**.

Al resolver un issue se puede ligar a una release:

- **Resolver** (sin más): cualquier evento nuevo lo reabre.
- **En la próxima release**: solo lo reabre un evento de una release posterior a la última conocida. Los eventos de versiones viejas que siguen en circulación se cuentan, pero no lo reabren.
- **En la release X**: la corrección va en X; un evento de X o posterior lo reabre.

Un issue que se reabre solo se marca como **regresión**, con la release en la que reapareció. Las versiones se comparan como semver y, si no lo son (un hash de git, una fecha), por el orden en que se vieron. Un issue ignorado sigue ignorado. Ante la duda (evento sin release, versiones incomparables) se reabre: es preferible un aviso de más a esconder una regresión.

## Source maps

Los bundles de producción están minificados: sin ayuda, un stack trace apunta a `app.3f2a.js:1:48213`. Si subes los source maps del build, Sentinel traduce cada frame al código original (`src/cart/total.ts:42:17 in computeTotal`) y guarda las líneas de alrededor para verlas en el issue.

1. Crea un **token de API** en `/:org/tokens` (se muestra una sola vez; en la base solo queda su hash).
2. En el CI, **antes de desplegar**, sube los mapas con la CLI (ver `packages/cli`):
   `sentinel-cli sourcemaps upload ./dist --release 1.4.0`. El diálogo de archivos de cada release trae este comando ya rellenado.
3. Inicializa el SDK con la misma `release`.

Detalles que conviene saber:

- La traducción ocurre **en el worker, antes de agrupar**: el mismo error en dos builds distintos es un solo issue. Por eso solo se traducen los eventos que llegan *después* de subir el mapa.
- Los archivos se identifican por su ruta sin origen (`~/assets/app.js`), así que sirven en producción, staging o un CDN. Subir el mismo archivo otra vez lo reemplaza.
- Los mapas se guardan comprimidos (hasta 25 MB cada uno) y nunca se exponen: no hace falta publicarlos en tu servidor.
- Si falta el mapa o no se puede resolver un frame, el evento se guarda igual con el frame original.

Para verlo funcionando sin configurar nada: `pnpm seed:demo && pnpm demo:sourcemaps` minifica un pequeño checkout, sube su mapa con la CLI, envía un error ocurrido en el bundle y te dice qué abrir.

## Datos sensibles

Los eventos pueden arrastrar secretos sin que nadie lo note (una contraseña en un formulario, un `Authorization` en las cabeceras, un token en la URL). La API los elimina **antes de encolar el evento**, así que nunca llegan a Redis ni a la base de datos (`packages/shared/src/scrub.ts`):

- **Por clave**: el valor de cualquier campo llamado `password`, `token`, `secret`, `api_key`, `authorization`, `cookie`, `credit_card`, `cvv`, `ssn`... (en cualquier estilo: `apiKey`, `X-Api-Key`, `refresh_token`) se reemplaza por `[Filtered]`, en cualquier profundidad.
- **Por contenido**, en cualquier texto (mensajes, URLs, breadcrumbs, `extra`): JWT, `Bearer ...`, números de tarjeta válidos (algoritmo de Luhn), claves de AWS/GitHub/Stripe/Slack, `usuario:clave@` en URLs, parámetros como `?access_token=...`, `password=...` y bloques de clave privada.
- No se tocan los campos de identificación (`event_id`, `release`, `user.id`...) ni mensajes normales como `Invalid token: expired`: un filtro que esconde de más hace los errores ilegibles.

Es una red de seguridad, no un sustituto de no enviar datos sensibles: el SDK ya omite el texto de los clicks y la query de las URLs.

## SDK de React

`packages/sdk-react` (`@sentinel/react`) añade un `ErrorBoundary` que envía los errores de render con la pila de componentes, `withErrorBoundary` y `reactRootOptions()` para los handlers de React 19 (`onUncaughtError`, `onCaughtError`, `onRecoverableError`). Cada error se envía una sola vez aunque llegue por varios caminos. Ver su [README](packages/sdk-react/README.md).
