"""Sentinel SDK para Python: captura errores, mide peticiones y continúa las trazas del navegador."""

from __future__ import annotations

import logging
import sys
import threading
from typing import Any, Dict, Optional

from ._version import SDK_VERSION
from .client import Client
from .options import Options
from .scope import get_current_scope, isolation_scope
from .tracing import (
    Span,
    Transaction,
    format_traceparent,
    get_current_span,
    get_current_transaction,
    parse_traceparent,
    start_child_span,
    status_from_http,
    trace,
)

__version__ = SDK_VERSION
__all__ = [
    "Client",
    "Options",
    "Span",
    "Transaction",
    "add_breadcrumb",
    "capture_exception",
    "capture_message",
    "close",
    "flush",
    "format_traceparent",
    "get_client",
    "get_current_span",
    "get_current_transaction",
    "init",
    "SentinelAsgiMiddleware",
    "SentinelWsgiMiddleware",
    "isolation_scope",
    "parse_traceparent",
    "set_context",
    "set_extra",
    "set_tag",
    "set_tags",
    "set_user",
    "setup_flask",
    "start_span",
    "start_transaction",
    "status_from_http",
    "trace",
]

logger = logging.getLogger("sentinel_sdk")
_client: Optional[Client] = None
_uninstall: list = []


def init(dsn: str, **options: Any) -> Client:
    """
    Inicializa el SDK. Llamar una sola vez, lo antes posible (antes de crear la aplicación).
    Con una DSN inválida el SDK queda desactivado y no lanza.
    """
    global _client
    if _client is not None:
        close(timeout=0.5)
    opts = Options(dsn=dsn, **options)
    client = Client(opts)
    _client = client
    if client.enabled:
        from .integrations import install_defaults

        _uninstall.extend(install_defaults(client))
    return client


def get_client() -> Optional[Client]:
    return _client


def capture_exception(error: Any = None, **hint: Any) -> Optional[str]:
    """Envía una excepción (por defecto, la que se está manejando). Devuelve el id del evento."""
    return _client.capture_exception(error, **hint) if _client else None


def capture_message(message: str, level: str = "info", **hint: Any) -> Optional[str]:
    return _client.capture_message(message, level, **hint) if _client else None


def add_breadcrumb(category: Optional[str] = None, message: Optional[str] = None, level: Optional[str] = None, data: Optional[Dict[str, Any]] = None, type: Optional[str] = None) -> None:
    crumb = {k: v for k, v in {"category": category, "message": message, "level": level, "data": data, "type": type}.items() if v is not None}
    get_current_scope().add_breadcrumb(crumb)


def set_user(user: Optional[Dict[str, str]]) -> None:
    get_current_scope().user = dict(user) if user else None


def set_tag(key: str, value: str) -> None:
    get_current_scope().tags[key] = value


def set_tags(tags: Dict[str, str]) -> None:
    get_current_scope().tags.update(tags)


def set_context(name: str, context: Optional[Dict[str, Any]]) -> None:
    scope = get_current_scope()
    if context is None:
        scope.contexts.pop(name, None)
    else:
        scope.contexts[name] = context


def set_extra(key: str, value: Any) -> None:
    get_current_scope().extra[key] = value


def start_transaction(name: str, op: str = "custom", **kwargs: Any) -> Transaction:
    """
    Una transacción manual (un trabajo, un script). Úsala con `with` para que los spans que abras
    dentro cuelguen de ella, o termínala con `finish()`. Sin `traces_sample_rate`, no se registra.
    """
    if _client is None:
        return Transaction(_NullClient(), name, op, sampled=False)
    return _client.start_transaction(name, op, **kwargs)


def start_span(op: str, description: Optional[str] = None, **data: Any) -> Span:
    """Span dentro de la transacción en curso; sin ninguna, no se registra. Úsalo con `with`."""
    return start_child_span(op, description, **data)


def flush(timeout: Optional[float] = None) -> bool:
    return _client.flush(timeout) if _client else True


def close(timeout: Optional[float] = None) -> bool:
    global _client
    client, _client = _client, None
    while _uninstall:
        try:
            _uninstall.pop()()
        except Exception:  # restaurar nunca debe lanzar
            logger.debug("sentinel_sdk: error while uninstalling", exc_info=True)
    return client.close(timeout) if client else True


class _NullClient:
    """Para medir con el SDK sin iniciar: todo funciona igual y nada se envía."""

    options = Options(dsn="")

    def should_sample_trace(self) -> bool:
        return False

    def send_transaction(self, tx: Transaction) -> None:  # pragma: no cover - nunca muestreada
        return None

    def current_user(self) -> None:
        return None

    def current_tags(self) -> Dict[str, str]:
        return {}


_ = (sys, threading)  # reservados para las integraciones


def __getattr__(name: str) -> Any:
    """Las integraciones se importan al usarlas: no se paga su coste ni se exige su dependencia."""
    if name == "SentinelAsgiMiddleware":
        from .integrations.asgi import SentinelAsgiMiddleware

        return SentinelAsgiMiddleware
    if name == "SentinelWsgiMiddleware":
        from .integrations.wsgi import SentinelWsgiMiddleware

        return SentinelWsgiMiddleware
    if name == "setup_flask":
        from .integrations.flask import setup_flask

        return setup_flask
    raise AttributeError(f"module 'sentinel_sdk' has no attribute {name!r}")
