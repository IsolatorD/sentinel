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
- `packages/sdk-core` — núcleo común de los SDK (`@sentinel/core`): cliente, transporte, filtros y rendimiento
- `packages/sdk-browser` — SDK de navegador (`@sentinel/browser`)
- `packages/sdk-react` — SDK de React (`@sentinel/react`)
- `packages/sdk-node` — SDK de Node.js (`@sentinel/node`)
- `examples/browser-demo`, `examples/node-demo` — páginas y servidor para probar los SDK; juntos muestran una traza que cruza del navegador al backend
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

## Ingesta de transacciones (rendimiento)

`POST /api/:projectId/transactions` — público, con la misma clave de DSN (`X-Sentinel-Key` o `?sentinel_key=`), el mismo límite por proyecto y el mismo CORS abierto que `/events`. Responde `202 { id }` y encola la transacción en la cola `transactions` de BullMQ; el worker normaliza las fechas y la guarda con sus spans (`perf_transaction` y `perf_span`) de forma atómica. Un reenvío con el mismo `transaction_id` no se duplica.

- **Formato:** esquema Zod en `packages/shared/src/transactions.ts`. Una transacción lleva `trace_id` (32 hex), `span_id` (16 hex), `name`, `op`, `duration_ms`, `status`, `release`, `environment`, `user`, `measurements` (los Web Vitals: `lcp`, `cls`, `inp`, `fcp`, `ttfb`, u otras medidas) y hasta 200 `spans` (`span_id`, `parent_span_id`, `op`, `description`, `start_timestamp`, `duration_ms`).
- **Datos sensibles:** pasan por el mismo filtro que los eventos antes de encolarse (tokens en URLs, cabeceras `authorization`...).
- **SDK:** `@sentinel/browser` las genera con `tracesSampleRate > 0` (ver su README); cualquier otro lenguaje puede enviarlas con una petición HTTP.
- **Consulta:** ver [API de rendimiento](#api-de-rendimiento).

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
| GET | `/:issueId/stats?period=` | eventos del issue a lo largo del tiempo (ver abajo) |


Parámetros del listado: `status` (`unresolved` por defecto, `resolved`, `ignored` o `all`), `level`, `q` (busca en título y culprit), `sort` (`lastSeen`, `firstSeen`, `events`), `order`, `limit` (máx. 100) y `offset`. Cada issue incluye `userCount` (usuarios distintos afectados). Un issue resuelto que vuelve a ocurrir se reabre solo; uno ignorado sigue ignorado.

### Gráficos de tendencia

`GET /api/organizations/:orgId/projects/:projectId/stats?period=` (proyecto) y `…/issues/:issueId/stats?period=` (issue) devuelven una serie **continua**, con los intervalos vacíos a cero, en UTC: `24h` por hora, `7d` cada 6 horas y `30d` por día. Cada punto trae `events` y `users` (usuarios distintos); la respuesta incluye `totalEvents`. El listado de issues añade `trends`: las últimas 24 h por hora de cada issue de la página, para el mini gráfico de cada fila. La agrupación la hace Postgres con `date_bin`, apoyada en los índices `(issue_id, timestamp)` y `(project_id, timestamp)`.

## API de rendimiento

Requiere sesión; cualquier miembro puede leer. Cuelga de un proyecto: `/api/organizations/:orgId/projects/:projectId/performance`. Todos los endpoints aceptan `period` (`24h` por defecto, `7d`, `30d`), `environment` y `release`.

| Método | Ruta | |
|---|---|---|
| GET | `/transactions` | transacciones agrupadas por nombre: ocurrencias, p50/p95/p99 de la duración, tasa de errores y throughput (por minuto). Admite `q`, `sort` (`count`, `p50`, `p95`, `errorRate`, `tpm`, `lastSeen`), `order`, `limit`, `offset` |
| GET | `/overview` | resumen del periodo, serie continua con p50/p95 por intervalo y Web Vitals valorados. Con `name`, solo de esa transacción |
| GET | `/samples?name=` | ejemplos de una transacción: `sort=slowest` (por defecto) o `recent` |
| GET | `/traces/:traceId` | una **traza completa**: las transacciones de cada servicio (cada una con la transacción de la que cuelga) y los errores capturados durante ella |
| GET | `/samples/:transactionId` | una transacción con sus spans, ordenados por inicio y con su nivel de anidación, listos para la cascada |

**Error ↔ traza:** cuando un SDK captura un error durante una transacción, el evento lleva `contexts.trace` (`trace_id` y `span_id`) y el worker guarda el `trace_id` en la columna `event.trace_id` (indexada). Con eso, el detalle de un error enlaza a su traza, y la traza muestra a la vez lo que midieron el navegador y el backend (anidados: el servidor cuelga del span de `fetch` que lo llamó) y los errores que hubo en cada lado. El detalle de una transacción también avisa si su traza tiene más servicios o errores.

Los percentiles se calculan en Postgres con `percentile_cont`. La serie usa los mismos intervalos que los gráficos de issues (`date_bin`, en UTC): `24h` por hora, `7d` cada 6 horas, `30d` por día. De los Web Vitals se da el **percentil 75**, que es el que valora Google, con los umbrales bueno / necesita mejorar / malo (LCP 2,5 s / 4 s, CLS 0,1 / 0,25, INP 200 / 500 ms, FCP 1,8 / 3 s, TTFB 0,8 / 1,8 s); solo aparecen los que se llegaron a medir.

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

**Pantallas:** acceso y registro (email y Google si está configurado), onboarding guiado (organización → proyecto → instalación del SDK con la DSN), proyectos, issues, detalle de un issue (con navegación entre eventos) configuración del proyecto (claves DSN, instalación según la plataforma, zona de peligro) y **rendimiento** (transacciones agrupadas con p50/p95/p99, errores y throughput, gráfico de latencia, Web Vitals valorados y, por cada ejemplo, la cascada de spans). Cada issue y el proyecto tienen además su gráfico de tendencia.

**Arquitectura** (atómica, ver `PLAN.md` §2.2): `components/{atoms,molecules,organisms,templates}`, `pages/`, `services/` (única capa que llama a la API, validando con los esquemas de `shared`) y `hooks/` (TanStack Query sobre los services). Ningún componente ni página importa un service; un test lo verifica en cada ejecución. El estado de la pantalla (filtros, página, pestaña, evento elegido) vive en la URL.

**Estructura de carpetas** (la verifica `architecture.test.ts`): cada componente, página, hook, service y util vive en su propia carpeta con su mismo nombre, y solo declara una cosa:

```
components/atoms/Button/
├── Button.tsx              # el componente
├── ButtonInterface.d.ts    # sus interfaces y tipos
└── Button.constants.ts     # constantes y helpers que no necesitan estar dentro (variantes, listas, funciones puras)
```

Los subcomponentes que solo usa su padre van anidados (`organisms/Sidebar/OrgSwitcher/`); los exportados y reutilizables, al lado de los demás. Las funciones de ayuda globales están en `utils/`. Los imports usan la ruta completa (`@/components/atoms/Button/Button`), sin `index.ts`. El cliente HTTP es axios (`services/http`).

Rutas: `/login`, `/register`, `/onboarding`, `/:org/projects`, `/:org/projects/:proyecto/issues`, `/:org/projects/:proyecto/issues/:issue`, `/:org/projects/:proyecto/settings`, `/:org/projects/:proyecto/performance` (con `performance/transaction?name=` y `performance/samples/:id`).

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

## SDK de Node.js

`packages/sdk-node` (`@sentinel/node`) captura los errores del proceso (`uncaughtException`, `unhandledRejection`), mide cada petición que atiende un servidor `http`/`https` (y con él Express, Fastify o Nest) y las peticiones salientes (`http`, `https`, `fetch`), y **continúa la traza que llega del navegador** en la cabecera `traceparent`: la transacción del frontend y la del backend comparten `trace_id`. Un error capturado durante una petición lleva el `trace_id` de su transacción. Ver su [README](packages/sdk-node/README.md).

Los tres SDK comparten `packages/sdk-core`: el cliente (alcance, filtros, muestreo, deduplicación), el transporte con reintentos, la normalización de eventos y el tracing. Cada plataforma aporta lo suyo: el navegador, la carga de página, Web Vitals y la navegación; Node, `AsyncLocalStorage` para tener una transacción por petición y la instrumentación de `http`.

## Alertas

Cada proyecto tiene una página **Alertas** con tres pestañas: **Reglas** (cuándo avisar), **Canales** (adónde) e **Historial** (qué se envió y con qué resultado).

**Reglas** — avisan por uno o varios canales:
- *Issue nuevo* y *Regresión* (un issue resuelto reaparece en una release posterior, ver más arriba).
- *Frecuencia*: un mismo issue acumula N eventos dentro de una ventana (de 1 minuto a 1 día). Es lo que detecta los picos.
- Filtros opcionales por **entorno** y **nivel mínimo**, y una **espera** entre avisos (1 hora por defecto) para no recibir el mismo issue una y otra vez.

**Canales**:
- **Email**: a todos los miembros de la organización o solo a algunos. Se envía un correo por persona. Necesita `SMTP_URL`; en desarrollo `pnpm infra:up` levanta **Mailpit** (buzón de pruebas en http://localhost:8025) y basta con `SMTP_URL=smtp://localhost:1025`.
- **Webhook**: un POST JSON firmado a tu URL.
- **Slack**: el formato de los webhooks entrantes de Slack (también lo aceptan Discord, con `/slack` al final de su URL, y Teams).

Cada canal tiene un botón **Enviar prueba**. Los avisos se entregan en segundo plano (otra cola del worker): si el destino falla se reintenta con espera creciente (5 intentos); un `4xx` no se reintenta porque no se arreglaría solo. Todo queda en el historial.

### Webhook

```json
{
  "event": "issue.new",
  "delivery_id": "6b0f…",
  "timestamp": "2026-10-09T12:00:00.000Z",
  "rule": { "name": "Errores nuevos", "trigger": "new_issue" },
  "organization": { "id": "…", "name": "Acme", "slug": "acme" },
  "project": { "id": "…", "name": "Storefront", "slug": "storefront" },
  "issue": { "id": "…", "title": "TypeError: …", "culprit": "computeTotal (cart.ts:42)", "level": "error",
             "eventCount": 1, "environment": "production", "release": "2.4.0", "regressedInRelease": null, "…": "…" },
  "url": "https://tu-panel/acme/projects/storefront/issues/…"
}
```

`event` es `issue.new`, `issue.regression`, `issue.frequency` (que añade `frequency: { count, windowMinutes }`) o `alert.test`. Los cambios futuros solo añadirán campos.

**Verifica la firma** para saber que la petición viene de Sentinel. Al crear el canal se muestra una sola vez su secreto (`whsec_…`):

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function isValid(req, rawBody, secret) {
  const timestamp = req.headers["x-sentinel-timestamp"];
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false; // rechaza reenvíos antiguos
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  const received = String(req.headers["x-sentinel-signature"]);
  return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
```

Otras cabeceras: `X-Sentinel-Event`, `X-Sentinel-Delivery` (id del envío, útil para deduplicar si se reintenta).

### Seguridad

- Un webhook es una URL que **el servidor visita por orden de un usuario**: sin cuidado, se podría apuntar a la red interna o a los metadatos de la nube (SSRF). Se rechazan `localhost`, IPs privadas y de enlace local, credenciales en la URL y esquemas que no sean http(s); se comprueba al crear el canal y de nuevo al conectar (resolviendo el DNS, contra el rebinding), sin seguir redirecciones y con un tiempo máximo.
- Solo en desarrollo, `ALLOW_PRIVATE_WEBHOOKS=true` permite destinos locales (los e2e lo usan).
- Las URLs de Slack/webhook se guardan completas pero la API solo las devuelve enmascaradas. Gestionar canales y reglas requiere rol owner o admin; cualquier miembro puede verlas.
- Los avisos están en inglés por ahora (el servidor no conoce el idioma de cada destinatario).

## Colaboración

- **Responsable**: cualquier miembro puede asignar un issue a otro miembro de la organización (o dejarlo sin asignar) desde su cabecera. El listado se filtra por *Asignados a mí*, *Sin asignar* o una persona (`?assignee=me|unassigned|<id>`).
- **Actividad**: cada issue tiene una pestaña con sus **comentarios** y el registro de los cambios (quién lo resolvió, reabrió, ignoró o asignó, con su release). Los comentarios los escribe cualquier miembro; solo su autor los edita, y su autor o un owner/admin los borra. El registro de cambios no se edita.
- **Miembros** (`/:org/members`): lista de personas con su rol; owners y admins invitan por correo, cambian roles (`member`/`admin`), quitan miembros y reenvían o cancelan invitaciones pendientes. El owner no se puede degradar ni quitar desde aquí.
- **Invitaciones por correo**: se envía un enlace (`/accept-invitation/<id>`) a la dirección invitada. Si esa persona no tiene sesión, pasa por el login (o el registro) y **vuelve al enlace** (`?redirect=`, solo rutas internas). La invitación solo la puede aceptar la cuenta con ese correo.

El correo no lo envía la API sino el worker, a través de una cola (`emails`): así hay un único lugar con acceso al SMTP y los fallos se reintentan sin bloquear la petición.

## Idioma, mensajes y avisos

- **Idioma de la persona**: se elige en el menú de la cuenta y se guarda en su perfil (`GET/PATCH /api/me/preferences`: idioma, tema y recorridos vistos), así que la sigue entre dispositivos. La primera vez se toma el del navegador.
- **Errores traducidos desde el backend**: el panel manda su idioma en `Accept-Language` y la API responde en él, incluidos los mensajes de validación (con el valor recibido: «se esperaba texto, recibido número»). Cada error lleva `code` (genérico, según el estado HTTP) y `reason` (específico y estable, p. ej. `ISSUE_NOT_FOUND`): si el texto no llegara, el panel traduce con el mismo catálogo.
- **Catálogo único** en `packages/shared/src/messages` (`en.ts` y `es.ts`, con las mismas claves y los mismos `{{valores}}`; un test lo verifica). Sirve a errores, avisos de éxito y correos.
- **Avisos de éxito (sonner)**: las operaciones (crear un proyecto, resolver un issue, asignarlo, comentar, crear un canal...) declaran su aviso con `@Notice(...)` y la API lo manda ya traducido en la cabecera `X-Sentinel-Message` (más `X-Sentinel-Message-Code`), sin cambiar el cuerpo de la respuesta. Las operaciones de Better Auth (organizaciones, invitaciones, miembros) no pasan por nuestra API de la misma forma, así que sus avisos los redacta el panel.
- **Correos en el idioma de cada destinatario**: las invitaciones usan el idioma del invitado si ya tiene cuenta; si no, el de quien invita. Las alertas por email se escriben una a una en el idioma de cada miembro. Los webhooks y Slack se mantienen en inglés (no hay un destinatario con idioma).

Añadir un idioma: una clave nueva en `SUPPORTED_LOCALES`, su catálogo, el locale de Zod y los textos del panel.
