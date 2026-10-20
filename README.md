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
- `packages/sdk-browser` — SDK de navegador (`@argus-isolator/browser`)
- `packages/sdk-react` — SDK de React (`@argus-isolator/react`)
- `packages/sdk-node` — SDK de Node.js (`@argus-isolator/node`)
- `packages/sdk-react-native` — SDK de React Native (`@argus-isolator/react-native`)
- `packages/sdk-python` — SDK de Python (`sentinel-sdk`), con su propio entorno y tests en pytest
- `examples/browser-demo`, `examples/node-demo`, `examples/python-demo` — página y servidores para probar los SDK; juntos muestran una traza que cruza del navegador al backend
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

`PATCH /:projectId` también acepta `retentionDays` (30, 90, 180 o 365) y `monthlyEventQuota` / `monthlyTransactionQuota` (entero o `null` = sin límite).

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
- **SDK:** `@argus-isolator/browser` las genera con `tracesSampleRate > 0` (ver su README); cualquier otro lenguaje puede enviarlas con una petición HTTP.
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

## Retención, cuotas y estadísticas

- **Retención:** cada proyecto conserva sus datos `retentionDays` días (90 por defecto). El worker ejecuta un job diario (`RETENTION_CRON`, por defecto `0 3 * * *`; `RETENTION_ENABLED=false` lo desactiva) que borra por lotes los issues sin actividad en ese periodo, sus eventos antiguos y las transacciones antiguas.
- **Cuotas:** límites mensuales opcionales de eventos y de transacciones por proyecto (el mes es UTC). Los contadores viven en Redis y se siembran desde la base de datos. Superado el límite, la ingesta responde `429` con `reason: QUOTA_EXCEEDED` y `Retry-After`; los eventos rechazados o inválidos no cuentan. `GET /api/organizations/:orgId/projects/:projectId/usage` devuelve el uso del mes y los límites.
- **Dashboard:** `GET /api/organizations/:orgId/projects/:projectId/dashboard?period=24h|7d|30d&environment=` devuelve totales (con los del periodo anterior de igual duración), series de eventos y transacciones, desgloses por nivel, entorno y release, los issues con más eventos y las transacciones más lentas (p95). En la web es la página «Resumen» del proyecto.

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

Rutas públicas: `/` (**landing** de Sentinel para quien no tiene sesión: qué es, funciones, SDK con su instalación, trazas y arquitectura; con sesión lleva a la organización) y `/docs` (documentación). Rutas: `/login`, `/register`, `/onboarding`, `/:org/projects`, `/:org/projects/:proyecto/issues`, `/:org/projects/:proyecto/issues/:issue`, `/:org/projects/:proyecto/settings`, `/:org/projects/:proyecto/performance` (con `performance/transaction?name=` y `performance/samples/:id`).

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

## Instalar las SDK

Las SDK **no están en npm** (podrán estarlo más adelante). Se instalan desde archivos que se construyen de este mismo repositorio, de tres formas equivalentes:

1. **Desde tu instancia de Sentinel** (lo más cómodo): cada instancia sirve las SDK en `https://TU-DOMINIO/sdk/`, ya a la versión que ella ejecuta. La pantalla de configuración del proyecto y el asistente de bienvenida muestran los comandos con tu dominio y tu DSN.
   ```bash
   npm install https://TU-DOMINIO/sdk/sentinel-browser.tgz                       # navegador
   npm install https://TU-DOMINIO/sdk/sentinel-browser.tgz https://TU-DOMINIO/sdk/sentinel-react.tgz   # React
   npm install https://TU-DOMINIO/sdk/sentinel-node.tgz                          # Node.js
   npm install https://TU-DOMINIO/sdk/sentinel-react-native.tgz                  # React Native
   npm install -g https://TU-DOMINIO/sdk/sentinel-cli.tgz                        # CLI de source maps
   pip install https://TU-DOMINIO/sdk/sentinel-sdk.tar.gz                        # Python
   ```
   Para una etiqueta `<script>`: `<script src="https://TU-DOMINIO/sdk/sentinel.min.js"></script>`.
2. **Desde una Release de GitHub:** al subir una etiqueta (`git tag v0.2.0 && git push origin v0.2.0`) el workflow `release.yml` publica los mismos archivos. Como no llevan versión en el nombre, `https://github.com/IsolatorD/sentinel/releases/latest/download/sentinel-browser.tgz` apunta siempre a la última.
3. **Python directamente desde git:** `pip install "git+https://github.com/IsolatorD/sentinel#subdirectory=packages/sdk-python"`.

Cada paquete de JavaScript es autosuficiente: lleva dentro `@sentinel/core` y `@sentinel/shared`, también sus tipos de TypeScript. La excepción es `@argus-isolator/react`, que necesita el SDK del navegador (se instalan juntos, como arriba). Los archivos se generan con `pnpm build && ./scripts/pack-sdks.sh`.

### Publicar en npm (mantenedor)

Los paquetes `@argus-isolator/browser`, `react`, `node`, `react-native` y `cli` están preparados para npm (la organización `argus-isolator` es gratuita para paquetes públicos). El workflow `release.yml` los publica al subir una etiqueta, con *provenance* (npm muestra que salieron de este repositorio):

1. En npmjs.com: *Access Tokens → Generate New Token → Granular*, con permiso de lectura y escritura sobre el scope `@argus-isolator` (y que **no** pida el código de verificación al publicar, o el workflow no podrá hacerlo).
2. Guardarlo como secreto del repositorio, sin pegarlo en ningún sitio: `gh secret set NPM_TOKEN --repo IsolatorD/sentinel`.
3. Subir la versión de los paquetes (`version` en cada `package.json` y `SDK_VERSION`), `git tag vX.Y.Z && git push origin vX.Y.Z`.

Una versión ya publicada no se puede reutilizar ni sustituir: cada cambio es una versión nueva. Ensayo sin publicar: `pnpm -r publish --dry-run --access public --no-git-checks`.

## SDK de React

`packages/sdk-react` (`@argus-isolator/react`) añade un `ErrorBoundary` que envía los errores de render con la pila de componentes, `withErrorBoundary` y `reactRootOptions()` para los handlers de React 19 (`onUncaughtError`, `onCaughtError`, `onRecoverableError`). Cada error se envía una sola vez aunque llegue por varios caminos. Ver su [README](packages/sdk-react/README.md).

## SDK de Node.js

`packages/sdk-node` (`@argus-isolator/node`) captura los errores del proceso (`uncaughtException`, `unhandledRejection`), mide cada petición que atiende un servidor `http`/`https` (y con él Express, Fastify o Nest) y las peticiones salientes (`http`, `https`, `fetch`), y **continúa la traza que llega del navegador** en la cabecera `traceparent`: la transacción del frontend y la del backend comparten `trace_id`. Un error capturado durante una petición lleva el `trace_id` de su transacción. Ver su [README](packages/sdk-node/README.md).

Los tres SDK comparten `packages/sdk-core`: el cliente (alcance, filtros, muestreo, deduplicación), el transporte con reintentos, la normalización de eventos y el tracing. Cada plataforma aporta lo suyo: el navegador, la carga de página, Web Vitals y la navegación; Node, `AsyncLocalStorage` para tener una transacción por petición y la instrumentación de `http`.

## SDK de Python

`packages/sdk-python` (`sentinel-sdk`) hace en Python lo que el de Node: captura los errores sin controlar (con su stack, el código fuente alrededor de cada línea y la cadena de causas), mide cada petición de una aplicación **ASGI** (FastAPI, Starlette...) o **WSGI** (Flask, Django...), mide `requests` y `httpx`, y continúa la traza que llega del navegador. No tiene dependencias. Ver su [README](packages/sdk-python/README.md).

Es un paquete aparte (Python, con su `pyproject.toml` y su entorno virtual: `pnpm --filter @sentinel/python setup`). Para no divergir del servidor, sus tests validan cada payload contra el **JSON Schema generado desde los esquemas Zod** de ingesta (`packages/shared/src/json-schemas.ts`), y un test de `shared` falla si ese JSON se desactualiza.

## SDK de React Native

`packages/sdk-react-native` (`@argus-isolator/react-native`) captura los errores de JavaScript (un error **fatal** retiene el cierre de la app hasta enviarse), las promesas rechazadas (Hermes), mide el arranque de la app, cada pantalla (`instrumentNavigation`, para React Navigation y Expo Router) y las peticiones de red (instrumenta `XMLHttpRequest`, que cubre `fetch` y axios), y envía lo pendiente al pasar a segundo plano. Los frames del bundle se envían como `app:///index.android.bundle` para que el servidor los simbolice con los source maps de la release (subidos con `sentinel-cli`). Ver su [README](packages/sdk-react-native/README.md).

## Alertas

Cada proyecto tiene una página **Alertas** con tres pestañas: **Reglas** (cuándo avisar), **Canales** (adónde) e **Historial** (qué se envió y con qué resultado).

**Reglas** — avisan por uno o varios canales:
- *Issue nuevo* y *Regresión* (un issue resuelto reaparece en una release posterior, ver más arriba).
- *Frecuencia*: un mismo issue acumula N eventos dentro de una ventana (de 1 minuto a 1 día). Es lo que detecta los picos.
- *Rendimiento*: **latencia p95** por encima de N ms, o **tasa de errores** por encima de N %, medidas sobre las transacciones que llegaron en una ventana (de 5 minutos a 1 día). Vigilan todo el proyecto o **una transacción concreta** (p. ej. `/checkout`), con filtro opcional de entorno. Con menos de 10 transacciones en la ventana no se avisa. Mientras el problema siga, la **espera** de la regla (1 hora por defecto) evita repetir el aviso; no hay aviso de «recuperado».
- Filtros opcionales por **entorno** y **nivel mínimo** (este último solo en reglas de issues), y una **espera** entre avisos (1 hora por defecto) para no recibir el mismo issue una y otra vez.

**Canales**:
- **Email**: a todos los miembros de la organización o solo a algunos. Se envía un correo por persona. Necesita `SMTP_URL`; en desarrollo `pnpm infra:up` levanta **Mailpit** (buzón de pruebas en http://localhost:8025) y basta con `SMTP_URL=smtp://localhost:1025`.
- **Webhook**: un POST JSON firmado a tu URL.
- **Slack**: el formato de los webhooks entrantes de Slack (también lo aceptan Discord, con `/slack` al final de su URL, y Teams).

Las reglas de rendimiento las evalúa un job del worker (cola `performance-alerts`) cada minuto (`PERFORMANCE_ALERTS_CRON`, por defecto `* * * * *`; `PERFORMANCE_ALERTS_ENABLED=false` lo desactiva). Cada evaluación mide con una consulta por regla (`percentile_cont` sobre `perf_transaction.received_at`), así que la ventana cuenta por cuándo *llegaron* las transacciones, no por cuándo empezaron.

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

`event` es `issue.new`, `issue.regression`, `issue.frequency` (que añade `frequency: { count, windowMinutes }`), `performance.p95`, `performance.error_rate` o `alert.test`. Los cambios futuros solo añadirán campos.

Los avisos de rendimiento no llevan `issue`, sino `performance` (y `url` apunta a la pantalla de rendimiento, o a la transacción):

```json
{
  "event": "performance.p95",
  "delivery_id": "6b0f…",
  "timestamp": "2026-10-09T12:00:00.000Z",
  "rule": { "name": "Checkout lento", "trigger": "p95_above" },
  "organization": { "id": "…", "name": "Acme", "slug": "acme" },
  "project": { "id": "…", "name": "Storefront", "slug": "storefront" },
  "performance": { "transaction": "/checkout", "environment": "production",
                   "value": 3840, "threshold": 2000, "windowMinutes": 15, "sampleCount": 120 },
  "url": "https://tu-panel/acme/projects/storefront/performance/transaction?name=%2Fcheckout"
}
```

`value` es el p95 en milisegundos (`performance.p95`) o el porcentaje de transacciones con error, de 0 a 100 (`performance.error_rate`); `transaction` es `null` si la regla vigila todo el proyecto.

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
- **Aviso por correo al asignar**: quien recibe un issue recibe un correo (en su idioma, con un enlace al issue). No se envía si se lo asigna a sí mismo ni al quitar la asignación, y cada persona puede desactivarlo desde el menú de su cuenta (preferencia `emailOnAssign`, activada por defecto; `PATCH /api/me/preferences`).
- **Actividad**: cada issue tiene una pestaña con sus **comentarios** y el registro de los cambios (quién lo resolvió, reabrió, ignoró o asignó, con su release). Los comentarios los escribe cualquier miembro; solo su autor los edita, y su autor o un owner/admin los borra. El registro de cambios no se edita.
- **Miembros** (`/:org/members`): lista de personas con su rol; owners y admins invitan por correo, cambian roles (`member`/`admin`), quitan miembros y reenvían o cancelan invitaciones pendientes. El owner no se puede degradar ni quitar desde aquí.
- **Invitaciones por correo**: se envía un enlace (`/accept-invitation/<id>`) a la dirección invitada. Si esa persona no tiene sesión, pasa por el login (o el registro) y **vuelve al enlace** (`?redirect=`, solo rutas internas). La invitación solo la puede aceptar la cuenta con ese correo.

El correo no lo envía la API sino el worker, a través de una cola (`emails`): así hay un único lugar con acceso al SMTP y los fallos se reintentan sin bloquear la petición.

## Despliegue en producción

Todo corre en una sola máquina con Docker Compose: **Caddy** (HTTPS automático + la web estática + proxy hacia la API), la API, el worker, Postgres y Redis. Solo Caddy publica puertos (80 y 443). Con la web y la API bajo el mismo dominio las cookies de sesión no necesitan CORS, y la DSN de las SDK usa ese mismo dominio. El ensayo local usó unos 340 MB de RAM en total.

```bash
git clone <este-repo> sentinel && cd sentinel
./deploy/gen-env.sh 203-0-113-10.sslip.io     # crea .env.production con secretos aleatorios
$EDITOR .env.production                        # SMTP_URL y SMTP_FROM (y REQUIRE_EMAIL_VERIFICATION)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
./deploy/smoke-test.sh https://203-0-113-10.sslip.io
```

- **Dominio:** sin dominio propio sirve `<ip-con-guiones>.sslip.io` (para la IP `203.0.113.10`, `203-0-113-10.sslip.io`); Let's Encrypt emite certificado válido para esos nombres. Con un dominio propio, un registro A hacia la IP y `DOMAIN=sentinel.tudominio.com`. Cambiar de dominio exige actualizar `DOMAIN` y las DSN de las apps.
- **Arquitectura:** las imágenes se construyen igual en amd64 y arm64 (`Dockerfile`, destinos `api`, `worker` y `web`). Las VM gratuitas de Oracle (Ampere A1) son ARM.
- **Migraciones:** el servicio `migrate` las aplica en cada arranque y la API y el worker esperan a que termine bien.
- **Actualizar:** `git pull && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build` (los datos viven en volúmenes de Docker).
- **Correo:** cualquier SMTP vale (`smtp://USUARIO:CLAVE@host:587`); Brevo ofrece un plan gratuito de unos 300 correos al día. El remitente tiene que estar verificado en el proveedor. Sin `SMTP_URL`, nadie puede verificar su correo: pon `REQUIRE_EMAIL_VERIFICATION=false`.
- **Oracle Cloud (Always Free):** además de abrir los puertos 80 y 443 en la lista de seguridad de la red de la instancia, las imágenes de Ubuntu de Oracle traen reglas de `iptables` que los bloquean: hay que permitirlos también dentro de la VM.
- **Instancia abierta al público (demo):** en `.env.production`, `DEFAULT_MONTHLY_EVENT_QUOTA`, `DEFAULT_MONTHLY_TRANSACTION_QUOTA` y `DEFAULT_RETENTION_DAYS` fijan los límites con los que **nacen los proyectos nuevos** (los existentes no cambian; cada proyecto puede cambiarlos en Configuración → Datos y límites). `SIGNUP_ENABLED=false` cierra el registro, también el de Google: quien ya tiene cuenta sigue entrando, y la web oculta «Crear cuenta». Ojo: con el registro cerrado nadie nuevo puede aceptar una invitación; ábrelo un momento para invitar.
- **Cuenta de demo con datos:** desde tu equipo (con el repo y Node) y con el registro abierto y la verificación de correo desactivada, `node examples/seed/seed.mjs --api https://TU-DOMINIO --web-origin https://TU-DOMINIO` crea `demo@sentinel.dev` / `demo-password-123` con un proyecto lleno de errores y transacciones. Esas credenciales son públicas: cualquiera con ellas puede modificar esa cuenta.
- **Limpiar la prueba de humo:** en el servidor, `./deploy/cleanup-smoke.sh` borra las cuentas, organizaciones y proyectos que crea `deploy/smoke-test.sh`.
- **Secretos:** `.env.production` está en `.gitignore`. Si cambias `BETTER_AUTH_SECRET` se cierran las sesiones y el token de Jira guardado deja de poder leerse.

## Integración con Jira

Cada proyecto puede conectarse con **Jira Cloud** (Configuración → Jira) para crear un ticket a partir de un issue con un clic. Slack no necesita integración aparte: ya es un canal de alertas (webhook entrante).

- **Conexión** (solo owner/admin): sitio (`https://<equipo>.atlassian.net`), correo de la cuenta, **API token** ([cómo crear uno](https://id.atlassian.com/manage-profile/security/api-tokens)), clave del proyecto de Jira y tipo de issue (`Bug` por defecto). Al guardar se comprueba contra Jira que las credenciales sirven, que el proyecto existe y que el tipo de issue existe en él.
- **Seguridad**: solo se aceptan sitios `https://*.atlassian.net` (nunca hosts arbitrarios, así que no se puede usar para llegar a la red interna); el token se guarda cifrado con AES-256-GCM (clave derivada de `BETTER_AUTH_SECRET`: si ese secreto cambia hay que volver a conectar) y la API nunca lo devuelve. Al editar, dejar el token vacío conserva el guardado, pero solo si no cambian el sitio ni el correo.
- **Ticket**: cualquier miembro lo crea desde la cabecera del issue. Lleva el título, el culprit, el nivel, los contadores, la release y un enlace de vuelta al issue. Un issue tiene como mucho un ticket; el vínculo se ve en la cabecera (con enlace a Jira), se puede quitar (no borra el ticket en Jira) y cada cambio queda en la actividad del issue.
- **API**: `GET|PUT|DELETE /api/organizations/:orgId/projects/:projectId/integrations/jira` y `POST|DELETE …/issues/:issueId/ticket`. Un fallo de Jira responde 400 (credenciales, proyecto o tipo inválidos) o 502 (Jira no responde); el detalle de Jira solo queda en el log del servidor.
- No hay sincronización de vuelta (resolver el ticket no resuelve el issue): requeriría un webhook público de Jira hacia Sentinel.

## Idioma, mensajes y avisos

- **Idioma de la persona**: se elige en el menú de la cuenta y se guarda en su perfil (`GET/PATCH /api/me/preferences`: idioma, tema y recorridos vistos), así que la sigue entre dispositivos. La primera vez se toma el del navegador.
- **Errores traducidos desde el backend**: el panel manda su idioma en `Accept-Language` y la API responde en él, incluidos los mensajes de validación (con el valor recibido: «se esperaba texto, recibido número»). Cada error lleva `code` (genérico, según el estado HTTP) y `reason` (específico y estable, p. ej. `ISSUE_NOT_FOUND`): si el texto no llegara, el panel traduce con el mismo catálogo.
- **Catálogo único** en `packages/shared/src/messages` (`en.ts` y `es.ts`, con las mismas claves y los mismos `{{valores}}`; un test lo verifica). Sirve a errores, avisos de éxito y correos.
- **Avisos de éxito (sonner)**: las operaciones (crear un proyecto, resolver un issue, asignarlo, comentar, crear un canal...) declaran su aviso con `@Notice(...)` y la API lo manda ya traducido en la cabecera `X-Sentinel-Message` (más `X-Sentinel-Message-Code`), sin cambiar el cuerpo de la respuesta. Las operaciones de Better Auth (organizaciones, invitaciones, miembros) no pasan por nuestra API de la misma forma, así que sus avisos los redacta el panel.
- **Correos en el idioma de cada destinatario**: las invitaciones usan el idioma del invitado si ya tiene cuenta; si no, el de quien invita. Las alertas por email se escriben una a una en el idioma de cada miembro. Los webhooks y Slack se mantienen en inglés (no hay un destinatario con idioma).

Añadir un idioma: una clave nueva en `SUPPORTED_LOCALES`, su catálogo, el locale de Zod y los textos del panel.
