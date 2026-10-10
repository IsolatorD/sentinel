"""Middleware ASGI (FastAPI, Starlette, Litestar, Django con ASGI...)."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Dict, Optional

from .. import get_client
from ..scope import isolation_scope
from ..tracing import _current_span
from ._common import begin_transaction, finish_request, request_info

Scope = Dict[str, Any]
Receive = Callable[[], Awaitable[Dict[str, Any]]]
Send = Callable[[Dict[str, Any]], Awaitable[None]]


class SentinelAsgiMiddleware:
    """
    Envuelve tu aplicación ASGI::

        app = SentinelAsgiMiddleware(app)

    Mide cada petición (continuando la traza que llegue en `traceparent`), aísla el usuario y los
    breadcrumbs de cada una y captura las excepciones que lleguen hasta aquí. Las que tu framework
    convierte en una respuesta (p. ej. un 404 con `HTTPException`) no son errores.
    """

    def __init__(self, app: Any, transaction_name: Optional[Callable[[Scope], Optional[str]]] = None) -> None:
        self.app = app
        self.transaction_name = transaction_name

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        client = get_client()
        if scope["type"] not in ("http", "websocket") or client is None or not client.enabled:
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        method = scope.get("method", "GET") if scope["type"] == "http" else "WEBSOCKET"
        path = scope.get("path", "/")
        host = headers.get("host") or "localhost"

        with isolation_scope() as sc:
            sc.request = request_info(method, f"{scope.get('scheme', 'http')}://{host}{path}", headers.get("user-agent"))
            custom = self.transaction_name(scope) if self.transaction_name else None
            tx = begin_transaction(client, method, path, headers.get("traceparent"), custom)
            token = _current_span.set(tx) if tx is not None else None
            status: Optional[int] = None

            async def send_wrapper(message: Dict[str, Any]) -> None:
                nonlocal status
                if message["type"] == "http.response.start":
                    status = message["status"]
                await send(message)

            try:
                await self.app(scope, receive, send_wrapper)
            except asyncio.CancelledError:
                # El cliente cortó la conexión: no es un fallo de la aplicación.
                if tx is not None:
                    tx.status = "cancelled"
                raise
            except BaseException as error:
                client.capture_exception(error, tags={"handled": "false", "mechanism": "asgi"})
                status = status or 500
                raise
            finally:
                if token is not None:
                    _current_span.reset(token)
                if tx is not None and tx.status != "cancelled":
                    route = scope.get("route")
                    route_path = getattr(route, "path", None)
                    if isinstance(route_path, str):
                        tx.set_name(f"{method} {route_path}")
                    finish_request(tx, method, status)
                elif tx is not None:
                    tx.finish()
