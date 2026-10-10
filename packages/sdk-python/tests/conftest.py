from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Tuple

import pytest
from jsonschema import Draft202012Validator

import sentinel_sdk
from sentinel_sdk.client import Client
from sentinel_sdk.integrations import install_defaults
from sentinel_sdk.options import Options
from sentinel_sdk.scope import get_global_scope

KEY = "0123456789abcdef0123456789abcdef"
PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9"
DSN = f"https://{KEY}@sentinel.example.com/{PROJECT}"

SCHEMAS = Path(__file__).parent / "schemas"
_event_validator = Draft202012Validator(json.loads((SCHEMAS / "event.schema.json").read_text()))
_transaction_validator = Draft202012Validator(json.loads((SCHEMAS / "transaction.schema.json").read_text()))


class Sink:
    """Lo que el SDK habría enviado, ya validado contra el JSON Schema que sale de los esquemas Zod del servidor."""

    def __init__(self) -> None:
        self.items: List[Tuple[str, Dict[str, Any]]] = []
        self.lock = threading.Lock()
        self.client: Client

    def send(self, url: str, body: bytes, _key: str) -> Tuple[bool, bool, float]:
        with self.lock:
            self.items.append((url, json.loads(body)))
        return (True, False, 0.0)

    def _of(self, kind: str) -> List[Dict[str, Any]]:
        self.client.flush(5)
        return [payload for url, payload in self.items if url.endswith(f"/{kind}")]

    @property
    def events(self) -> List[Dict[str, Any]]:
        events = self._of("events")
        for event in events:
            errors = [e.message for e in _event_validator.iter_errors(event)]
            assert not errors, f"el evento no cumple el contrato del servidor: {errors}"
        return events

    @property
    def transactions(self) -> List[Dict[str, Any]]:
        txs = self._of("transactions")
        for tx in txs:
            errors = [e.message for e in _transaction_validator.iter_errors(tx)]
            assert not errors, f"la transacción no cumple el contrato del servidor: {errors}"
        return txs


@pytest.fixture
def sdk() -> Any:
    """Inicia el SDK con un transporte simulado. `sdk(**opciones)` devuelve el `Sink`."""
    created: List[Client] = []

    def make(*, install: bool = True, **options: Any) -> Sink:
        sentinel_sdk.close(timeout=0.2)
        sink = Sink()
        options.setdefault("capture_global_errors", False)
        options.setdefault("log_breadcrumbs", False)
        client = Client(Options(dsn=DSN, **options), send_fn=sink.send, retry_delays=(0.0, 0.0))
        sink.client = client
        sentinel_sdk._client = client
        created.append(client)
        if install and client.enabled:
            sentinel_sdk._uninstall.extend(install_defaults(client))
        return sink

    yield make
    sentinel_sdk.close(timeout=0.5)
    scope = get_global_scope()
    scope.user, scope.tags, scope.contexts, scope.extra, scope.request = None, {}, {}, {}, None
    scope.breadcrumbs.clear()


class LocalServer:
    """Un servidor HTTP de verdad en localhost que guarda las cabeceras que recibe."""

    def __init__(self) -> None:
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        outer = self
        self.requests: List[Dict[str, Any]] = []
        self.status = 200

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                outer.requests.append({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}})
                self.send_response(outer.status)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"ok")

            def log_message(self, *args: Any) -> None:
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=lambda: self.server.serve_forever(poll_interval=0.01), daemon=True)
        self.thread.start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}"

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def local_server() -> Any:
    server = LocalServer()
    yield server
    server.stop()
