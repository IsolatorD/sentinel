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

### 2.2 Arquitectura del frontend (`apps/web`)

Arquitectura atómica (Atomic Design) y acceso a datos siempre a través de hooks:

```
apps/web/src/
├── components/
│   ├── atoms/        # botón, input, badge... (sin lógica de negocio)
│   ├── molecules/    # campo de formulario, tarjeta de issue...
│   ├── organisms/    # tabla de issues, formulario de login, sidebar...
│   └── templates/    # layouts de página (sin datos reales)
├── pages/            # pantallas: ensamblan templates y organismos con hooks
├── services/         # llamadas a la API (fetch/clientes); sin React
├── hooks/            # custom hooks (TanStack Query) que consumen los services
└── ...               # i18n, rutas, utilidades
```

Reglas:
- **Ningún componente llama a un service directamente.** Los componentes solo usan hooks; los hooks son los únicos que importan services.
- Los atoms y molecules reciben todo por props; los organisms/pages son quienes usan hooks.
- Los tipos y esquemas Zod vienen de `packages/shared`.
- Primera rebanada de UI implementada (acceso, onboarding, proyectos, issues, detalle y configuración) sobre un backend y un SDK ya completos. Un test de arquitectura (`apps/web/src/architecture.test.ts`) hace cumplir las reglas anteriores.

### 2.3 Arquitectura del backend

Monolito modular (un módulo de NestJS por feature) con capas internas `controller → service → repository`, reglas puras en `domain/` y dependencias en un solo sentido. Un módulo solo habla con otro a través de su service exportado. Los repositorios son la única capa que usa Drizzle; el de eventos es una interfaz (`EventRepository`) para poder cambiar Postgres por un almacén columnar si hiciera falta.

Transversal: entorno validado con Zod al arrancar, formato de error único, logs estructurados con `pino` (id de petición y datos sensibles redactados) y OpenAPI generado desde los esquemas Zod.

Descartado por ahora: arquitectura hexagonal completa, DDD con agregados, CQRS/bus de eventos y microservicios. El diseño modular deja abierta la puerta (p. ej. `IngestModule` solo depende de la base de datos y de Redis).

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
- Fase 4 ✅: `perf_transaction` (nombre, tipo, estado, duración, traza, release, entorno, medidas de Web Vitals) y `perf_span` (padre, tipo, descripción, inicio, duración). Sin particionar por ahora: índices por proyecto y fecha; se particionará cuando haya volumen real.

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

**Fase 3.5 — Experiencia de uso y pulido** (antes de la Fase 4, ordenada por dificultad y dependencias)

*Bloque A — rápidos y sin dependencias*
1. ✅ **Animaciones**: transiciones entre pantallas (View Transitions con alternativa en CSS), despliegue de tablas y paneles, skeletons con brillo, diálogos y menús. Respetan `prefers-reduced-motion`.
2. ✅ **Tutoriales guiados** para usuarios nuevos con driver.js; se recuerda quién ya los vio.
3. ✅ **Modo oscuro**: claro / oscuro / sistema, con la preferencia guardada.

*Bloque B — idioma y mensajes (lo más transversal)*
4. ✅ **Idioma del usuario**: se guarda en su perfil; la API lo resuelve por petición (preferencia > `Accept-Language` > por defecto). Los errores del backend salen ya traducidos desde un catálogo en `shared` indexado por código (el frontend conserva un texto de respaldo por código). Los correos (invitaciones, alertas) se envían en el idioma de **cada destinatario**.
5. ✅ **Avisos con sonner** (issue resuelto, proyecto creado...): el texto lo manda el backend en una cabecera de respuesta, sin cambiar la forma de los datos; el frontend tiene un respaldo. Límite: los endpoints de Better Auth (organizaciones, invitaciones) no los controlamos, así que sus avisos usan el texto del frontend.

*Bloque C — se apoya en el B*
6. ✅ **Verificación de cuenta por correo**: obligatoria para registros con email y contraseña cuando hay SMTP (Google ya llega verificado), con reenvío del correo.
7. ✅ **Gráficos de tendencia** por issue y por proyecto (agregación de eventos por intervalo en la API). Gráficos de barras en SVG propio (sin librería): panel en la lista y en el detalle, y un mini gráfico por fila.

*Pendiente suelto*: tests unitarios por archivo (cuando se indique). El aviso por correo al asignar y las integraciones (Jira; Slack como canal de alertas) se hicieron en la Fase 5.

**Fase 4 — Performance / tracing** ✅
- A. ✅ Ingesta: `POST /api/:projectId/transactions` (misma clave, límite y CORS que los eventos, con scrubbing), cola `transactions`, tablas `perf_transaction` y `perf_span`.
- B. ✅ SDK: `startTransaction` / `startSpan` / `trace`, medición automática de carga de página, navegaciones y `fetch`/XHR, Web Vitals (FCP, LCP, CLS, INP, TTFB), muestreo (`tracesSampleRate`, apagado por defecto), cabecera `traceparent` y `Profiler` de React. Los errores llevan el `trace_id` de la transacción en curso.
- C. ✅ API de consulta: transacciones agrupadas con p50/p95/p99, errores y throughput; resumen con serie temporal; Web Vitals valorados (p75); ejemplos y cascada de spans.
- D. ✅ UI: pantalla «Rendimiento» (tabla, gráfico de latencia, Web Vitals), detalle de transacción y de ejemplo con la cascada, recorrido guiado.
- E. ✅ Semilla y demo con transacciones, documentación.
- ✅ después de la fase: error ↔ traza enlazados en la UI (`event.trace_id`, `GET /performance/traces/:id`, página de traza con línea de tiempo entre servicios y errores).
- Fuera de la fase, para más adelante: SDK de servidor que continúe la traza (`traceparent`), particionado por fecha y retención.

**Fase 5 — Más plataformas y pulido**

*Hecho: SDK para más plataformas*
- ✅ **SDK de Node** (`@sentinel/node`, sobre el núcleo común `@sentinel/core`): errores del proceso, transacciones por petición con `AsyncLocalStorage`, spans de `http`/`https`/`fetch`, continuación de la traza vía `traceparent`, integraciones de Express y Fastify.
- ✅ **SDK de Python** (`sentinel-sdk`): ASGI, WSGI, Flask, Django, `requests`/`httpx`; validado contra el JSON Schema generado de los esquemas Zod.
- ✅ **SDK de React Native** (`@sentinel/react-native`): `ErrorUtils`, Hermes, arranque, navegación, XHR, simbolización con los source maps del bundle.

*Pendiente*
- ✅ **Landing del proyecto** (dentro de `apps/web`, ruta pública `/`; con sesión, `/` lleva a la organización como antes): la página pública de Sentinel y punto de entrada a todo lo demás: qué es, qué resuelve, capturas, las funciones (errores, rendimiento, trazas, alertas, source maps, colaboración), los SDK con su instalación, cómo está construido (arquitectura), y los enlaces a la API (`/api/docs`) y a la aplicación (iniciar sesión / crear cuenta). Es la landing *de Sentinel*; la web personal con todos los proyectos del autor es otro proyecto y queda fuera de este.
- ✅ **Documentación pública** (`/docs`, accesible desde la landing): primeros pasos, un apartado por SDK, source maps, trazas y rendimiento, alertas, API de ingesta. Sin guía de instalación: la instalación del servidor se explica en el README, no en la web.
- ✅ **Retención configurable** por proyecto (30/90/180/365 días, 90 por defecto): un job diario del worker borra eventos y transacciones antiguos y los issues sin actividad en ese periodo.
- ✅ **Cuotas mensuales** por proyecto (eventos y transacciones, opcionales): al superarlas la ingesta responde 429 `QUOTA_EXCEEDED` con `Retry-After`; uso y límites en Configuración y aviso en Issues/Rendimiento.
- ✅ **Dashboard de estadísticas** (`/:org/projects/:project/overview`): totales con variación frente al periodo anterior, series, desgloses por nivel/entorno/release, issues con más eventos y transacciones más lentas.
- ✅ **Email al asignar un issue**: correo en el idioma de quien lo recibe, con preferencia por usuario (`emailOnAssign`) y sin aviso al autoasignarse.
- ✅ **Alertas de rendimiento**: reglas `p95_above` y `error_rate_above` (proyecto o transacción, entorno opcional), evaluadas cada minuto por un job del worker; mismos canales, espera e historial que las de issues.
- ✅ **Integración con Jira Cloud**: conexión por proyecto (API token cifrado, solo `*.atlassian.net`), crear/desvincular un ticket desde el issue, con su rastro en la actividad. Slack queda cubierto por el canal de alertas existente. Fuera de alcance: sincronización de vuelta (webhooks de Jira) y OAuth.

## 7. Despliegue

**Decidido:** una VM gratuita (Oracle Cloud Always Free, Ampere ARM) con Docker Compose y Caddy para HTTPS; demo pública de portafolio; dominio de `sslip.io` hasta tener uno propio (después, un subdominio); correo por SMTP gratuito (Brevo); repo sin publicar en npm (las SDK se instalan desde las Releases de GitHub). Licencia propuesta: MIT.

- ✅ **A. Imágenes** (`Dockerfile`: `api`, `worker`, `web`) y servicio `migrate`.
- ✅ **B. `docker-compose.prod.yml`** y `deploy/Caddyfile`.
- ✅ **C. Configuración de producción**: `deploy/.env.production.example`, `deploy/gen-env.sh`, `deploy/smoke-test.sh`. Ensayo local completo (HTTPS, migraciones, registro, ingesta y worker) superado.
- ✅ **D. Modo demo abierto:** `DEFAULT_MONTHLY_EVENT_QUOTA`, `DEFAULT_MONTHLY_TRANSACTION_QUOTA` y `DEFAULT_RETENTION_DAYS` para los proyectos nuevos, `SIGNUP_ENABLED` (la web oculta el registro cuando está cerrado), cuenta de demo con el seed existente y `deploy/cleanup-smoke.sh`. Verificado en el stack de producción local.
- **E. Operación:** copias de seguridad de Postgres y su restauración, script de despliegue, chequeo externo de salud, Sentinel monitorizándose a sí mismo.
- **F. CI/CD y publicación:** GitHub Actions (lint, tests, e2e), imágenes en GHCR, `.tgz` de las SDK en cada Release (con `@sentinel/core` empaquetado dentro), bundle del navegador servido desde la instancia, `LICENSE`.
- **G. Documentación:** el README ya incluye la sección «Despliegue en producción»; faltan backups, actualización por versiones y cambio de dominio.

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
