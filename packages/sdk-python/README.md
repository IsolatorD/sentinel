# sentinel-sdk (Python)

> Instalación (las SDK aún no están en npm): ver [Instalar las SDK](../../README.md#instalar-las-sdk).

SDK de Sentinel para Python 3.9 o superior. Captura los errores, mide cada petición que atiende tu aplicación y **continúa las trazas que empiezan en el navegador**.

- **Sin dependencias**: solo la biblioteca estándar. Nada que instalar ni que choque con tu app.
- Nunca lanza ni rompe tu aplicación; el envío es en un hilo aparte con reintentos.
- Funciona con cualquier aplicación **ASGI** (FastAPI, Starlette, Litestar...) o **WSGI** (Flask, Django, Bottle, Pyramid...).

## Instalación y uso

```bash
pip install https://TU-DOMINIO/sdk/sentinel-sdk.tar.gz
```

```python
import sentinel_sdk

# Antes de crear la aplicación.
sentinel_sdk.init(
    "https://<clave>@sentinel.example.com/<projectId>",
    release="1.4.2",
    environment="production",
    traces_sample_rate=1.0,  # opcional: activa el rendimiento
)
```

### FastAPI / Starlette (ASGI)

```python
app = FastAPI()
app = sentinel_sdk.SentinelAsgiMiddleware(app)   # lo más externo
```

### Flask

```python
sentinel_sdk.setup_flask(app)   # nombra las transacciones con la ruta y captura los errores que Flask maneja
```

### Django

```python
# settings.py
MIDDLEWARE = ["sentinel_sdk.integrations.django.SentinelDjangoMiddleware", ...]

# wsgi.py
application = sentinel_sdk.SentinelWsgiMiddleware(get_wsgi_application())
```

### Cualquier otra aplicación WSGI

```python
app = sentinel_sdk.SentinelWsgiMiddleware(app)
```

## Qué hace solo

- **Errores sin controlar** del proceso (`sys.excepthook`, nivel `fatal`) y de los hilos (`threading.excepthook`), dejando actuar al manejador original. `KeyboardInterrupt` no se reporta.
- **Cada petición** (con los middlewares): una transacción `http.server` nombrada con la ruta registrada (`GET /users/{id}`) o, si no se conoce, con la URL sin ids (`/users/:id`). Un 5xx marca la transacción como fallida; un 4xx no, y una excepción que tu framework convierte en una respuesta (un `HTTPException` 404) no es un error. Si llega `traceparent`, **continúa esa traza** y respeta su decisión de muestreo.
- **Alcance por petición**: el usuario, los tags y los breadcrumbs de una petición no se mezclan con los de otras simultáneas (`contextvars`: funciona con hilos y con `asyncio`).
- **Peticiones salientes** de `requests` y `httpx` (síncrono y asíncrono): un span `http.client` por cada una, sin la query de la URL. La cabecera `traceparent` solo se añade a las URLs de `trace_propagation_targets` (por defecto, a ninguna).
- **`logging`**: lo que escribes con `logging` (INFO o más) se guarda como breadcrumbs; con `capture_logged_errors=True`, los errores registrados se envían como eventos.
- **Contexto en los errores**: la petición (ruta sin query y user-agent), el `trace_id` de su transacción (para saltar del error a su traza), el runtime y el SO.

## API

| Función | Descripción |
|---|---|
| `init(dsn, **opciones)` | Inicializa el SDK. Con una DSN inválida queda desactivado, sin lanzar. |
| `capture_exception(error=None, **hint)` | Envía una excepción; sin argumento, la que se está manejando. Devuelve el id del evento. |
| `capture_message(texto, nivel="info", **hint)` | Envía un mensaje. `hint` acepta `tags`, `extra`, `user`, `contexts` y `fingerprint`. |
| `add_breadcrumb(category=, message=, level=, data=)` | Breadcrumb manual. |
| `set_user()`, `set_tag()`, `set_tags()`, `set_context()`, `set_extra()` | Datos que acompañan a los eventos siguientes (del alcance actual). |
| `isolation_scope()` | Un alcance propio para lo que corra dentro (un trabajo, una tarea). |
| `start_transaction(nombre, op)` | Transacción manual: úsala con `with`. |
| `start_span(op, descripción, **datos)` | Span dentro de la transacción en curso: úsalo con `with`, o termínalo con `.finish()`. |
| `@trace(op, descripción)` | Decorador: mide cada llamada a la función (síncrona o `async`). |
| `flush(segundos)`, `close(segundos)` | Esperan los envíos pendientes; `close` además quita la instrumentación. Al salir del intérprete se envía lo pendiente solo. |

```python
with sentinel_sdk.start_transaction("importar-pedidos", "task") as tx:
    with sentinel_sdk.start_span("db.query", "cargar usuarios"):
        users = load_users()
    tx.set_measurement("rows", len(users))

@sentinel_sdk.trace("email", "enviar resumen")
def send_summary(): ...
```

## Opciones de `init`

| Opción | Por defecto | |
|---|---|---|
| `release`, `environment` | — | Para filtrar y detectar regresiones. |
| `sample_rate` | `1.0` | Fracción de eventos que se envían. |
| `traces_sample_rate` | `0.0` | Fracción de transacciones que se registran. Con 0 el rendimiento está apagado. |
| `trace_propagation_targets` | ninguna | Substrings o regex de las URLs a las que se añade `traceparent`. |
| `ignore_errors` | — | Clases de excepción, nombres o regex sobre `"Tipo: mensaje"` que no se envían. |
| `before_send(event, hint)` | — | Modifica el evento o devuelve `None` para descartarlo. |
| `before_send_transaction(tx)` | — | Igual, para transacciones. |
| `max_breadcrumbs` | `50` | Máximo 100. |
| `max_events_per_minute` | `60` | Corta las tormentas de errores. |
| `max_spans` | `100` | Máximo de spans por transacción (hasta 200). |
| `tags`, `user`, `server_name` | — | Iniciales. |
| `project_root` | directorio de trabajo | Las rutas de los archivos se envían relativas a esta carpeta. |
| `in_app_include`, `in_app_exclude` | — | Prefijos de módulos que cuentan (o no) como código propio. |
| `capture_global_errors` | `True` | Captura las excepciones sin controlar del proceso y de los hilos. |
| `log_breadcrumbs`, `capture_logged_errors` | `True`, `False` | Qué hacer con `logging`. |
| `http_client_spans` | `True` | Instrumenta `requests` y `httpx` si están instalados. |
| `shutdown_timeout` | `2.0` | Segundos que se esperan a enviar lo pendiente al salir. |
| `enabled`, `debug` | `True`, `False` | Apagar el SDK; mensajes del SDK en stderr. |

## Cómo se agrupan los errores

Los frames llevan el **módulo** (`shop.orders`) además de la ruta relativa, y el servidor agrupa por módulo y función: el mismo error es el mismo issue aunque se ejecute en otra máquina o en otra carpeta. Cada frame de tu código lleva su línea y las 5 anteriores y posteriores, que verás en el detalle del issue. Las dependencias y la biblioteca estándar se marcan como ajenas a tu app.

## Cómo envía

`POST <host>/api/<projectId>/events` y `/transactions`, con la clave en `X-Sentinel-Key`, en un hilo de fondo con una cola acotada (si se llena, descarta antes que bloquear tu app). Reintenta los errores de red y los 5xx con espera creciente, y se pausa lo que pida el servidor ante un 429. Tras un `fork` (gunicorn con `--preload`) el hilo se recrea solo. Los datos sensibles los filtra el servidor antes de guardar.

## Desarrollo

```bash
pnpm --filter @sentinel/python setup   # crea .venv e instala el SDK en modo editable con sus dependencias de prueba
pnpm --filter @sentinel/python test
```

Los tests (pytest) validan **cada evento y cada transacción contra el JSON Schema generado a partir de los esquemas Zod del servidor** (`tests/schemas/`, se regenera con `pnpm --filter @sentinel/shared export:schemas`; un test del paquete `shared` falla si se desactualiza), así que el SDK no puede divergir del contrato sin que falle un test. Usan servidores HTTP reales en `localhost` para `requests` y `httpx`, Starlette y Flask reales, y Django configurado en el propio test.
