"""Django: nombra las transacciones con la ruta y captura los errores que Django convierte en un 500."""

from __future__ import annotations

import sys
from typing import Any, Callable

from .. import get_client
from ..tracing import get_current_transaction

_connected = False


def _capture(sender: Any, request: Any = None, **_extra: Any) -> None:
    """Django maneja las excepciones de las vistas y devuelve un 500: no llegan al servidor, así que se usa su señal."""
    client = get_client()
    exc_info = sys.exc_info()
    if client is not None and client.enabled and exc_info[1] is not None:
        client.capture_exception(exc_info, tags={"handled": "true", "mechanism": "django"})


def _connect() -> None:
    global _connected
    if _connected:
        return
    from django.core.signals import got_request_exception

    got_request_exception.connect(_capture, dispatch_uid="sentinel_sdk")
    _connected = True


class SentinelDjangoMiddleware:
    """
    Añádelo a `MIDDLEWARE` y envuelve la aplicación WSGI (o ASGI) con el middleware del SDK::

        # settings.py
        MIDDLEWARE = ["sentinel_sdk.integrations.django.SentinelDjangoMiddleware", ...]

        # wsgi.py
        application = SentinelWsgiMiddleware(get_wsgi_application())

    El middleware de Django pone a cada transacción el nombre de su ruta (`GET /users/<int:id>/`);
    el del SDK la mide y aísla el alcance de cada petición.
    """

    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response
        _connect()

    def __call__(self, request: Any) -> Any:
        return self.get_response(request)

    def process_view(self, request: Any, view_func: Any, view_args: Any, view_kwargs: Any) -> None:
        tx = get_current_transaction()
        match = getattr(request, "resolver_match", None)
        route = getattr(match, "route", None)
        if tx is not None and route:
            tx.set_name(f"{request.method} /{route.lstrip('^/')}" if not route.startswith("/") else f"{request.method} {route}")
